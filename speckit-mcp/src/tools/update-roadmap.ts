import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readRoadmap, writeRoadmap, getRoadmapPath } from '../lib/filesystem.js';
import type { RoadmapFeature } from '../types.js';

const VALID_STATUSES = [
  'not-started',
  'specifying',
  'planning',
  'tasking',
  'implementing',
  'analyzing',
  'complete',
] as const;

export function registerUpdateRoadmapTool(server: McpServer): void {
  server.registerTool(
    'speckit_update_roadmap',
    {
      description:
        'Update the status of a feature in .specify/roadmap.md. Call this after completing a phase (e.g., mark a feature as "implementing" when starting implementation, or "complete" when all tasks are done). Returns an updated roadmap summary.',
      inputSchema: {
        featureName: z
          .string()
          .describe(
            'The feature name exactly as it appears in the roadmap (e.g. "User Authentication")'
          ),
        newStatus: z
          .enum(VALID_STATUSES)
          .describe(
            'New status for the feature: not-started | specifying | planning | tasking | implementing | analyzing | complete'
          ),
      },
    },
    async ({ featureName, newStatus }) => {
      const content = await readRoadmap();

      if (!content) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No roadmap found at ${getRoadmapPath()}.\n\nRun speckit_load_roadmap with roadmapContent to create one first.`,
            },
          ],
        };
      }

      const result = updateFeatureStatus(content, featureName, newStatus);

      if (!result.updated) {
        return {
          content: [
            {
              type: 'text' as const,
              text: buildNotFoundMessage(featureName, result.availableFeatures),
            },
          ],
        };
      }

      await writeRoadmap(result.content);

      return {
        content: [
          {
            type: 'text' as const,
            text: buildUpdateSummary(featureName, newStatus, result.content),
          },
        ],
      };
    }
  );
}

interface UpdateResult {
  updated: boolean;
  content: string;
  availableFeatures: string[];
}

function updateFeatureStatus(
  content: string,
  featureName: string,
  newStatus: RoadmapFeature['status']
): UpdateResult {
  // Collect all feature names for helpful error messages
  const availableFeatures: string[] = [];
  const featureHeaderPattern = /###\s+Feature\s+\d+:\s+([^\n]+)/g;
  let hm;
  while ((hm = featureHeaderPattern.exec(content)) !== null) {
    availableFeatures.push(hm[1].trim());
  }

  // Try exact match first, then case-insensitive/partial
  const targetName = findMatchingFeatureName(featureName, availableFeatures);
  if (!targetName) {
    return { updated: false, content, availableFeatures };
  }

  // Build a pattern that matches the feature section
  // Escape special regex chars in the target name
  const escapedName = targetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const featureSectionPattern = new RegExp(
    `(###\\s+Feature\\s+\\d+:\\s+${escapedName}\\n[\\s\\S]*?)(\\*\\*Status\\*\\*:\\s*)[^\\n]+`,
    'i'
  );

  let updated = false;
  const newContent = content.replace(featureSectionPattern, (_match, prefix, statusLabel) => {
    updated = true;
    return `${prefix}${statusLabel}${newStatus}`;
  });

  if (!updated) {
    // The feature exists but may not have a **Status** line — add one
    // Find the feature section and append a Status line after the last existing field
    const insertPattern = new RegExp(
      `(###\\s+Feature\\s+\\d+:\\s+${escapedName}\\n(?:[^#][^\\n]*\\n)*)`,
      'i'
    );
    const newContent2 = content.replace(insertPattern, (match) => {
      // Check if it ends with a newline
      const suffix = match.endsWith('\n') ? '' : '\n';
      return `${match}${suffix}- **Status**: ${newStatus}\n`;
    });

    if (newContent2 !== content) {
      return { updated: true, content: newContent2, availableFeatures };
    }

    return { updated: false, content, availableFeatures };
  }

  return { updated: true, content: newContent, availableFeatures };
}

function findMatchingFeatureName(
  searchName: string,
  availableFeatures: string[]
): string | null {
  // Exact match
  if (availableFeatures.includes(searchName)) return searchName;

  // Case-insensitive exact
  const lower = searchName.toLowerCase();
  const exact = availableFeatures.find((f) => f.toLowerCase() === lower);
  if (exact) return exact;

  // Starts with
  const startsWith = availableFeatures.find((f) => f.toLowerCase().startsWith(lower));
  if (startsWith) return startsWith;

  // Contains
  const contains = availableFeatures.find((f) => f.toLowerCase().includes(lower));
  if (contains) return contains;

  return null;
}

function buildNotFoundMessage(featureName: string, available: string[]): string {
  const lines = [
    `Feature "${featureName}" not found in the roadmap.`,
    '',
    'Available features:',
    ...available.map((f) => `  - ${f}`),
    '',
    'Make sure the feature name matches exactly (or partially) what is in roadmap.md.',
  ];
  return lines.join('\n');
}

function buildUpdateSummary(
  featureName: string,
  newStatus: RoadmapFeature['status'],
  updatedContent: string
): string {
  const statusIcon: Record<string, string> = {
    'not-started': '⬜',
    specifying: '📝',
    planning: '📐',
    tasking: '📋',
    implementing: '🔨',
    analyzing: '🔍',
    complete: '✅',
  };

  const lines = [
    `# Roadmap Updated`,
    '',
    `${statusIcon[newStatus] ?? '⬜'} **${featureName}** → \`${newStatus}\``,
    '',
    '## Current Roadmap Status',
  ];

  // Parse features for summary table
  const featureHeaderPattern = /###\s+Feature\s+\d+:\s+([^\n]+)\n([\s\S]*?)(?=###\s+Feature\s+\d+:|$)/g;
  let match;
  while ((match = featureHeaderPattern.exec(updatedContent)) !== null) {
    const name = match[1].trim();
    const body = match[2];
    const statusMatch = body.match(/\*\*Status\*\*:\s*([^\n]+)/i);
    const status = statusMatch ? statusMatch[1].trim() : 'not-started';
    const icon = statusIcon[status] ?? '⬜';
    lines.push(`- ${icon} ${name} — \`${status}\``);
  }

  const totalFeatures = (updatedContent.match(/###\s+Feature\s+\d+:/g) ?? []).length;
  const completeFeatures = (updatedContent.match(/\*\*Status\*\*:\s*complete/gi) ?? []).length;
  lines.push('');
  lines.push(`**Progress**: ${completeFeatures}/${totalFeatures} features complete`);

  if (completeFeatures === totalFeatures && totalFeatures > 0) {
    lines.push('');
    lines.push('🎉 **All features complete!**');
  }

  return lines.join('\n');
}
