import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as path from 'path';
import { getSpecsDir, writeSpecFile, getFeatureDir, ensureDir } from '../lib/filesystem.js';
import { getNextFeatureNumber, createFeatureBranch } from '../lib/git.js';
import { getTemplate } from '../lib/templates.js';
import { slugify, getDate, padFeatureNumber, buildBranchName } from '../lib/utils.js';

export function registerSpecifyTool(server: McpServer): void {
  server.registerTool(
    'speckit_specify',
    {
      description:
        'Create a new feature specification from a plain-language description. Generates the feature directory, creates a spec.md from the Spec Kit template, and optionally creates a git branch. Claude should then fill in the spec template.',
      inputSchema: {
        description: z.string().describe('Plain-language description of the feature to build'),
        shortName: z
          .string()
          .optional()
          .describe(
            'Short kebab-case name for the feature (e.g. "user-auth", "payment-flow"). Auto-derived from description if not provided.'
          ),
      },
    },
    async ({ description, shortName }) => {
      // Determine feature number
      const featureNumber = await getNextFeatureNumber();
      const paddedNum = padFeatureNumber(featureNumber);

      // Derive short name
      const slug = shortName ? slugify(shortName) : slugify(description.split(' ').slice(0, 4).join(' '));
      const branchName = buildBranchName(featureNumber, shortName ?? description.split(' ').slice(0, 4).join(' '));
      const featureName = branchName; // e.g. 001-user-auth

      // Ensure specs directory exists
      const specsDir = getSpecsDir();
      ensureDir(specsDir);

      // Create feature directory
      const featureDir = getFeatureDir(featureName);
      ensureDir(featureDir);

      // Build spec content from template
      const date = getDate();
      const specContent = getTemplate('spec')
        .replace('[FEATURE NAME]', featureName)
        .replace('[###-feature-name]', branchName)
        .replace('[DATE]', date)
        .replace('$ARGUMENTS', description);

      // Write spec.md
      const specFilePath = await writeSpecFile(featureName, 'spec.md', specContent);

      // Create contracts directory stub
      const contractsDir = path.join(featureDir, 'contracts');
      ensureDir(contractsDir);

      // Try to create git branch
      const branchResult = await createFeatureBranch(branchName);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Feature spec created: **${featureName}**

**Files created:**
- Spec: ${specFilePath}
- Contracts dir: ${contractsDir}

**Git branch:** ${branchResult.message}

**Branch name:** \`${branchName}\`
**Feature directory:** ${featureDir}

---

## Spec Template — Fill This In

${specContent}

---

**Instructions for Claude (architect):**
1. Review the template above carefully
2. Replace ALL placeholders in brackets with real content based on: "${description}"
3. Write at least 2 user stories with acceptance scenarios
4. Define measurable success criteria
5. After filling the spec, run \`speckit_clarify\` to identify any ambiguities
6. Then run \`speckit_plan\` to create the implementation plan`,
          },
        ],
      };
    }
  );
}
