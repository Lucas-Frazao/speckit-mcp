import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readRoadmap, writeRoadmap, getRoadmapPath, getSpecifyDir, ensureDir } from '../lib/filesystem.js';
import type { RoadmapFeature } from '../types.js';

export function registerLoadRoadmapTool(server: McpServer): void {
  server.registerTool(
    'speckit_load_roadmap',
    {
      description:
        'Load or save the project roadmap. If roadmapContent is provided, writes it to .specify/roadmap.md. Always parses and returns the roadmap with current feature statuses, priorities, dependencies, and user stories.',
      inputSchema: {
        roadmapContent: z
          .string()
          .optional()
          .describe('Full roadmap markdown content to write. If omitted, reads the existing roadmap.'),
      },
    },
    async ({ roadmapContent }) => {
      // Ensure .specify dir exists
      ensureDir(getSpecifyDir());

      // Write if content provided
      if (roadmapContent) {
        await writeRoadmap(roadmapContent);
      }

      // Read current roadmap
      const content = await readRoadmap();

      if (!content) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `No roadmap found at ${getRoadmapPath()}.\n\nProvide roadmapContent to create one, or run speckit_init first.`,
            },
          ],
        };
      }

      // Parse the roadmap
      const features = parseRoadmap(content);

      const summary = buildRoadmapSummary(features, content);

      return {
        content: [
          {
            type: 'text' as const,
            text: summary,
          },
        ],
      };
    }
  );
}

export function parseRoadmap(content: string): RoadmapFeature[] {
  const features: RoadmapFeature[] = [];

  // Split on ### Feature N: headings (robust to numbering, spacing, etc.)
  const featurePattern = /###\s+Feature\s+\d+:\s+([^\n]+)\n([\s\S]*?)(?=###\s+Feature\s+\d+:|$)/g;

  let match;
  while ((match = featurePattern.exec(content)) !== null) {
    const rawName = match[1].trim();
    const body = match[2];

    const feature = parseFeatureBlock(rawName, body);
    features.push(feature);
  }

  return features;
}

function parseFeatureBlock(rawName: string, body: string): RoadmapFeature {
  // Priority
  const priorityMatch = body.match(/\*\*Priority\*\*:\s*([^\n]+)/i);
  const priority = priorityMatch ? priorityMatch[1].trim() : 'P3';

  // Description — flexible: may say "Description:" or just be unlabelled
  const descMatch = body.match(/\*\*Description\*\*:\s*([^\n]+)/i);
  const description = descMatch ? descMatch[1].trim() : '';

  // User stories — look for "- US1: ..." or "  - US1: ..." lines
  const userStories: string[] = [];
  const storyPattern = /[-*]\s+(US\d+):\s*([^\n]+)/g;
  let sm;
  while ((sm = storyPattern.exec(body)) !== null) {
    userStories.push(`${sm[1]}: ${sm[2].trim()}`);
  }

  // Dependencies
  const depsMatch = body.match(/\*\*Dependencies\*\*:\s*([^\n]+)/i);
  const depsRaw = depsMatch ? depsMatch[1].trim() : 'none';
  const dependencies =
    depsRaw.toLowerCase() === 'none' || depsRaw === ''
      ? []
      : depsRaw
          .split(/,/)
          .map((d) => d.trim())
          .filter(Boolean);

  // Status
  const statusMatch = body.match(/\*\*Status\*\*:\s*([^\n]+)/i);
  const rawStatus = statusMatch ? statusMatch[1].trim().toLowerCase() : 'not-started';
  const status = normalizeStatus(rawStatus);

  // Slug: lowercase, spaces to hyphens, strip special chars
  const slug = rawName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  return {
    name: rawName,
    slug,
    priority,
    description,
    userStories,
    dependencies,
    status,
  };
}

function normalizeStatus(raw: string): RoadmapFeature['status'] {
  const valid: RoadmapFeature['status'][] = [
    'not-started',
    'specifying',
    'planning',
    'tasking',
    'implementing',
    'analyzing',
    'complete',
  ];
  const match = valid.find((s) => raw.includes(s.replace('-', ' ')) || raw === s);
  return match ?? 'not-started';
}

function buildRoadmapSummary(features: RoadmapFeature[], rawContent: string): string {
  if (features.length === 0) {
    return `Roadmap loaded but no features found.\n\nRaw content preview:\n${rawContent.slice(0, 500)}`;
  }

  // Extract project overview
  const overviewMatch = rawContent.match(/## Project Overview\n([\s\S]*?)(?=\n## )/);
  const overview = overviewMatch ? overviewMatch[1].trim() : '';

  // Extract tech stack
  const techMatch = rawContent.match(/## Tech Stack\n([\s\S]*?)(?=\n## )/);
  const techStack = techMatch ? techMatch[1].trim() : '';

  const statusCounts: Record<string, number> = {};
  for (const f of features) {
    statusCounts[f.status] = (statusCounts[f.status] ?? 0) + 1;
  }

  const lines: string[] = ['# Roadmap Loaded'];

  if (overview) {
    lines.push('', `## Project Overview`, overview);
  }

  if (techStack) {
    lines.push('', `## Tech Stack`, techStack);
  }

  lines.push('', `## Features (${features.length} total)`);

  for (const f of features) {
    const statusIcon = statusIconFor(f.status);
    lines.push('');
    lines.push(`### ${f.name}`);
    lines.push(`- **Priority**: ${f.priority}`);
    lines.push(`- **Status**: ${statusIcon} ${f.status}`);
    lines.push(`- **Description**: ${f.description || '(none)'}`);
    if (f.dependencies.length > 0) {
      lines.push(`- **Dependencies**: ${f.dependencies.join(', ')}`);
    }
    if (f.userStories.length > 0) {
      lines.push(`- **User Stories**:`);
      for (const us of f.userStories) {
        lines.push(`  - ${us}`);
      }
    }
  }

  lines.push('', '## Summary');
  for (const [status, count] of Object.entries(statusCounts)) {
    lines.push(`- ${statusIconFor(status as RoadmapFeature['status'])} ${status}: ${count}`);
  }

  const nextFeature = features.find((f) => f.status !== 'complete');
  if (nextFeature) {
    lines.push('', `**Next to work on**: ${nextFeature.name} (${nextFeature.priority}, ${nextFeature.status})`);
  } else {
    lines.push('', '**All features complete!**');
  }

  return lines.join('\n');
}

function statusIconFor(status: string): string {
  const icons: Record<string, string> = {
    'not-started': '⬜',
    specifying: '📝',
    planning: '📐',
    tasking: '📋',
    implementing: '🔨',
    analyzing: '🔍',
    complete: '✅',
  };
  return icons[status] ?? '⬜';
}
