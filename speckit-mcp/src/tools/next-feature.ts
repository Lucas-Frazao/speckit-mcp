import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readRoadmap, getRoadmapPath } from '../lib/filesystem.js';
import { parseRoadmap } from './load-roadmap.js';
import type { RoadmapFeature } from '../types.js';

export function registerNextFeatureTool(server: McpServer): void {
  server.registerTool(
    'speckit_next_feature',
    {
      description:
        'Find the next feature to work on from the roadmap. Reads .specify/roadmap.md and returns the first feature that is not complete and whose dependencies are all complete. Returns feature details (name, description, user stories, tech context) or { allComplete: true } if everything is done.',
      inputSchema: {},
    },
    async () => {
      const content = await readRoadmap();

      if (!content) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No roadmap found at ${getRoadmapPath()}.\n\nRun speckit_load_roadmap with your roadmap content first.`,
            },
          ],
        };
      }

      const features = parseRoadmap(content);

      if (features.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `The roadmap was loaded but contains no parseable features.\n\nCheck that your roadmap.md follows the expected format with "### Feature N: Name" headings.`,
            },
          ],
        };
      }

      const completedNames = new Set(
        features.filter((f) => f.status === 'complete').map((f) => f.name.toLowerCase())
      );

      // Find next eligible feature: not complete, all dependencies complete
      const next = features.find((f) => {
        if (f.status === 'complete') return false;
        // Check all dependencies are complete
        if (f.dependencies.length > 0) {
          for (const dep of f.dependencies) {
            const depLower = dep.toLowerCase().trim();
            // A dependency is satisfied if a feature name contains or matches the dep string
            const depSatisfied = Array.from(completedNames).some(
              (name) => name.includes(depLower) || depLower.includes(name)
            );
            if (!depSatisfied) return false;
          }
        }
        return true;
      });

      if (!next) {
        const allComplete = features.every((f) => f.status === 'complete');
        if (allComplete) {
          return {
            content: [
              {
                type: 'text' as const,
                text: buildAllCompleteMessage(features),
              },
            ],
          };
        }

        // Some features are incomplete but blocked by unmet dependencies
        return {
          content: [
            {
              type: 'text' as const,
              text: buildBlockedMessage(features, completedNames),
            },
          ],
        };
      }

      // Extract tech context from roadmap
      const techContext = extractTechContextFromRoadmap(content);

      return {
        content: [
          {
            type: 'text' as const,
            text: buildNextFeatureMessage(next, techContext, features),
          },
        ],
      };
    }
  );
}

function extractTechContextFromRoadmap(
  content: string
): Record<string, string> {
  const ctx: Record<string, string> = {};
  const techMatch = content.match(/## Tech Stack\n([\s\S]*?)(?=\n## )/);
  if (!techMatch) return ctx;

  const lines = techMatch[1].split('\n');
  for (const line of lines) {
    // Matches "- Language: TypeScript" or "- **Language**: TypeScript"
    const m = line.match(/[-*]\s+\*?\*?([^*:]+)\*?\*?:\s*(.+)/);
    if (m) {
      const key = m[1].toLowerCase().trim().replace(/\s+/g, '_');
      ctx[key] = m[2].trim();
    }
  }
  return ctx;
}

function buildNextFeatureMessage(
  feature: RoadmapFeature,
  techContext: Record<string, string>,
  allFeatures: RoadmapFeature[]
): string {
  const completedCount = allFeatures.filter((f) => f.status === 'complete').length;
  const totalCount = allFeatures.length;

  const lines = [
    `# Next Feature to Implement`,
    '',
    `## Feature: ${feature.name}`,
    `- **Priority**: ${feature.priority}`,
    `- **Current Status**: ${feature.status}`,
    `- **Description**: ${feature.description || '(see roadmap for details)'}`,
  ];

  if (feature.dependencies.length > 0) {
    lines.push(`- **Dependencies**: ${feature.dependencies.join(', ')} ✅ (all satisfied)`);
  }

  if (feature.userStories.length > 0) {
    lines.push('');
    lines.push('## User Stories');
    for (const us of feature.userStories) {
      lines.push(`- ${us}`);
    }
  }

  // Tech context
  if (Object.keys(techContext).length > 0) {
    lines.push('');
    lines.push('## Tech Context (from roadmap)');
    for (const [key, val] of Object.entries(techContext)) {
      lines.push(`- **${key}**: ${val}`);
    }
  }

  lines.push('');
  lines.push('## Roadmap Progress');
  lines.push(`${completedCount}/${totalCount} features complete`);
  for (const f of allFeatures) {
    const icon =
      f.status === 'complete'
        ? '✅'
        : f.name === feature.name
        ? '👉'
        : '⬜';
    lines.push(`${icon} ${f.name} (${f.priority}) — \`${f.status}\``);
  }

  lines.push('');
  lines.push('## Next Steps');
  lines.push(`Call \`speckit_execute_feature\` with:`);
  lines.push(`- featureName: "${feature.slug || feature.name}"`);
  lines.push(`- featureDescription: "${feature.description}"`);
  lines.push(`- userStories: ${JSON.stringify(feature.userStories)}`);
  if (Object.keys(techContext).length > 0) {
    lines.push(`- techContext: (from Tech Context section above)`);
  }

  return lines.join('\n');
}

function buildAllCompleteMessage(features: RoadmapFeature[]): string {
  const lines = [
    '# All Features Complete! 🎉',
    '',
    `All ${features.length} feature(s) in the roadmap are marked as complete.`,
    '',
    '## Feature Summary',
  ];
  for (const f of features) {
    lines.push(`✅ ${f.name} (${f.priority})`);
  }
  lines.push('');
  lines.push('The project roadmap is complete. Consider running a final validation or review.');
  return lines.join('\n');
}

function buildBlockedMessage(
  features: RoadmapFeature[],
  completedNames: Set<string>
): string {
  const lines = [
    '# No Available Features',
    '',
    'All remaining features have unmet dependencies.',
    '',
    '## Feature Status',
  ];

  for (const f of features) {
    if (f.status === 'complete') {
      lines.push(`✅ ${f.name} — complete`);
    } else {
      const unmetDeps = f.dependencies.filter((dep) => {
        const depLower = dep.toLowerCase().trim();
        return !Array.from(completedNames).some(
          (name) => name.includes(depLower) || depLower.includes(name)
        );
      });
      lines.push(`⛔ ${f.name} — blocked by: ${unmetDeps.join(', ')}`);
    }
  }

  lines.push('');
  lines.push('Complete the blocking features first, then call speckit_next_feature again.');
  return lines.join('\n');
}
