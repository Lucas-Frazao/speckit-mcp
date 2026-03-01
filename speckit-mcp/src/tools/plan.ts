import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as path from 'path';
import {
  readSpecFile,
  writeSpecFile,
  getFeatureDir,
  ensureDir,
  writeFileAbsolute,
} from '../lib/filesystem.js';
import { generateCopilotInstructions } from '../lib/copilot.js';
import { getTemplate } from '../lib/templates.js';
import { getDate, extractFeatureNumber } from '../lib/utils.js';
import type { TechContext } from '../types.js';

export function registerPlanTool(server: McpServer): void {
  server.registerTool(
    'speckit_plan',
    {
      description:
        'Create a technical implementation plan for a feature. Reads the spec, fills in the plan template with tech context, creates data-model.md and contracts stubs, and generates an updated copilot-instructions.md.',
      inputSchema: {
        featureName: z.string().describe('The feature directory name (e.g. "001-user-auth")'),
        techContext: z
          .object({
            language: z.string().describe('Programming language and version (e.g. "TypeScript 5.x")'),
            framework: z
              .string()
              .describe('Primary framework or library (e.g. "Express", "React", "FastAPI")'),
            storage: z
              .string()
              .optional()
              .describe('Storage solution (e.g. "PostgreSQL", "SQLite", "Redis")'),
            testing: z
              .string()
              .optional()
              .describe('Testing framework (e.g. "jest", "vitest", "pytest")'),
            platform: z
              .string()
              .optional()
              .describe('Target platform (e.g. "Linux server", "Web", "iOS")'),
            projectType: z
              .string()
              .describe('Project type (e.g. "web-app", "cli", "library", "api")'),
          })
          .describe('Technical context for the implementation'),
      },
    },
    async ({ featureName, techContext }) => {
      const specContent = await readSpecFile(featureName, 'spec.md');
      if (!specContent) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: No spec.md found for feature "${featureName}". Run speckit_specify first.`,
            },
          ],
        };
      }

      const date = getDate();
      const featureNumber = extractFeatureNumber(featureName);

      // Build plan content from template
      let planContent = getTemplate('plan')
        .replace('[FEATURE]', featureName)
        .replace('[###-feature-name]', featureName)
        .replace('[DATE]', date)
        .replace('[link]', `spec.md`)
        .replace('[e.g., Python 3.11, TypeScript 5.x]', techContext.language)
        .replace('[e.g., FastAPI, React, Express]', techContext.framework)
        .replace('[e.g., PostgreSQL, SQLite, files]', techContext.storage ?? 'N/A')
        .replace('[e.g., pytest, vitest, jest]', techContext.testing ?? 'N/A')
        .replace('[e.g., Linux server, Web, iOS]', techContext.platform ?? 'N/A')
        .replace('[e.g., web-app, cli, library, api]', techContext.projectType);

      // Extract summary from spec
      const firstDescMatch = specContent.match(/### User Story 1[^\n]*\n\n([^\n]+)/);
      if (firstDescMatch) {
        planContent = planContent.replace(
          '[Extract from feature spec: primary requirement + technical approach]',
          firstDescMatch[1].trim()
        );
      }

      const planFilePath = await writeSpecFile(featureName, 'plan.md', planContent);

      // Create data-model.md stub if spec mentions entities
      const createdFiles: string[] = [planFilePath];
      const hasEntities = specContent.includes('Key Entities') || specContent.includes('Entity');

      if (hasEntities) {
        const dataModelContent = buildDataModelStub(featureName, techContext);
        const dataModelPath = await writeSpecFile(featureName, 'data-model.md', dataModelContent);
        createdFiles.push(dataModelPath);
      }

      // Create contracts/api-spec.json stub if spec mentions API
      const hasApi =
        specContent.toLowerCase().includes('api') ||
        specContent.toLowerCase().includes('endpoint') ||
        specContent.toLowerCase().includes('request') ||
        techContext.projectType === 'api';

      if (hasApi) {
        const featureDir = getFeatureDir(featureName);
        const contractsDir = path.join(featureDir, 'contracts');
        ensureDir(contractsDir);
        const apiSpecPath = path.join(contractsDir, 'api-spec.json');
        const apiSpecContent = buildApiSpecStub(featureName);
        await writeFileAbsolute(apiSpecPath, apiSpecContent);
        createdFiles.push(apiSpecPath);
      }

      // Generate copilot-instructions.md
      const copilotPath = await generateCopilotInstructions({
        featureName,
        featureNumber,
        status: 'Planned',
        techContext: techContext as TechContext,
        architectureDecisions: extractArchDecisions(planContent),
      });
      createdFiles.push(copilotPath);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Implementation plan created for **${featureName}**

**Files created/updated:**
${createdFiles.map((f) => `- ${f}`).join('\n')}

---

## Plan — Fill In the Architecture Details

${planContent}

---

**Instructions for Claude (architect):**
1. Fill in the **Summary** section — what problem are we solving and how?
2. Complete the **Constitution Check** — verify alignment with project principles
3. Define the **Project Structure** — exact directories and file layout
4. Add **Architecture Decisions** — key technical choices with rationale
5. Note any **Complexity** violations and mitigations
6. After completing the plan, run \`speckit_tasks\` to generate the task breakdown`,
          },
        ],
      };
    }
  );
}

function buildDataModelStub(featureName: string, techContext: TechContext): string {
  return `# Data Model: ${featureName}

## Entities

### [EntityName]
| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | ${techContext.storage?.includes('Postgres') ? 'UUID' : 'string'} | Primary identifier | PK, not null |
| created_at | timestamp | Creation timestamp | not null |
| updated_at | timestamp | Last update timestamp | not null |

## Relationships

- [EntityA] has many [EntityB]
- [EntityB] belongs to [EntityA]

## Indexes

- Primary: id
- [Add indexes for frequently queried fields]

## Storage Notes

- Storage: ${techContext.storage ?? 'TBD'}
- Migration strategy: [describe]
`;
}

function buildApiSpecStub(featureName: string): string {
  return JSON.stringify(
    {
      openapi: '3.0.0',
      info: {
        title: `${featureName} API`,
        version: '1.0.0',
        description: `API contracts for feature ${featureName}`,
      },
      paths: {
        '/example': {
          get: {
            summary: 'Example endpoint — replace with actual endpoints',
            responses: {
              '200': {
                description: 'Success',
              },
            },
          },
        },
      },
    },
    null,
    2
  );
}

function extractArchDecisions(planContent: string): string {
  // Try to find an architecture decisions section
  const match = planContent.match(/## Architecture[^\n]*\n([\s\S]*?)(?=\n## |$)/);
  return match ? match[1].trim() : '';
}
