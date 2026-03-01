import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import * as path from 'path';
import {
  listFeatures,
  getFeatureArtifacts,
  readSpecFile,
  readConstitution,
  readCopilotInstructions,
  fileExists,
  getFeatureDir,
} from '../lib/filesystem.js';
import { parseTaskStatus, calculateProgress } from '../lib/utils.js';
import type { FeatureStatus } from '../types.js';

export function registerStatusTool(server: McpServer): void {
  server.registerTool(
    'speckit_status',
    {
      description:
        'Show the current status of a feature or list all features. Displays which artifacts exist, task completion percentage, and current phase.',
      inputSchema: {
        featureName: z
          .string()
          .optional()
          .describe(
            'Feature directory name (e.g. "001-user-auth"). If omitted, lists all features.'
          ),
      },
    },
    async ({ featureName }) => {
      if (featureName) {
        // Single feature status
        return getSingleFeatureStatus(featureName);
      } else {
        // All features status
        return getAllFeaturesStatus();
      }
    }
  );
}

async function getSingleFeatureStatus(
  featureName: string
): Promise<{ content: [{ type: 'text'; text: string }] }> {
  const featureDir = getFeatureDir(featureName);

  if (!fileExists(featureDir)) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Feature "${featureName}" not found. Run \`speckit_specify\` to create it.`,
        },
      ],
    };
  }

  const artifacts = getFeatureArtifacts(featureName);

  // Determine which key files exist
  const hasSpec = artifacts.includes('spec.md');
  const hasPlan = artifacts.includes('plan.md');
  const hasTasks = artifacts.includes('tasks.md');
  const hasDataModel = artifacts.includes('data-model.md');

  // Calculate task progress
  let progressStr = 'No tasks yet';
  let taskDetails = '';
  if (hasTasks) {
    const tasksContent = await readSpecFile(featureName, 'tasks.md');
    if (tasksContent) {
      const tasks = parseTaskStatus(tasksContent);
      const progress = calculateProgress(tasks);
      progressStr = `${progress.completed}/${progress.total} tasks (${progress.percentage}%)`;

      // Show incomplete tasks
      const incomplete = tasks.filter((t) => !t.completed);
      if (incomplete.length > 0) {
        const nextTask = incomplete[0];
        taskDetails = `\n**Next task**: ${nextTask.id} — ${nextTask.description}${nextTask.filePath ? `\n**Target file**: ${nextTask.filePath}` : ''}`;
      }
    }
  }

  // Determine overall status
  let status = 'Not started';
  if (hasSpec && !hasPlan) status = 'Spec written — needs plan';
  if (hasPlan && !hasTasks) status = 'Planned — needs task breakdown';
  if (hasTasks) {
    const tasksContent = await readSpecFile(featureName, 'tasks.md');
    if (tasksContent) {
      const tasks = parseTaskStatus(tasksContent);
      const progress = calculateProgress(tasks);
      if (progress.percentage === 100) {
        status = '✅ Complete';
      } else if (progress.completed > 0) {
        status = `🔨 In progress (${progress.percentage}%)`;
      } else {
        status = '📋 Ready to implement';
      }
    }
  }

  // Extract spec status line
  let specStatus = 'Draft';
  if (hasSpec) {
    const specContent = await readSpecFile(featureName, 'spec.md');
    const statusMatch = specContent?.match(/^Status:\s*(.+)$/m);
    if (statusMatch) specStatus = statusMatch[1].trim();
  }

  const artifactList = [
    `${hasSpec ? '✅' : '❌'} spec.md${hasSpec ? ` (${specStatus})` : ''}`,
    `${hasPlan ? '✅' : '❌'} plan.md`,
    `${hasTasks ? '✅' : '❌'} tasks.md`,
    `${hasDataModel ? '✅' : '⬜'} data-model.md`,
    ...artifacts
      .filter((a) => !['spec.md', 'plan.md', 'tasks.md', 'data-model.md'].includes(a))
      .map((a) => `⬜ ${a}`),
  ];

  return {
    content: [
      {
        type: 'text' as const,
        text: `## Feature Status: ${featureName}

**Status**: ${status}
**Progress**: ${progressStr}
**Directory**: ${featureDir}

### Artifacts
${artifactList.join('\n')}
${taskDetails}

### Workflow Checklist
${hasSpec ? '✅' : '⬜'} 1. Spec created (\`speckit_specify\`)
${specStatus !== 'Draft' ? '✅' : '⬜'} 2. Spec clarified (\`speckit_clarify\`)
${hasPlan ? '✅' : '⬜'} 3. Plan created (\`speckit_plan\`)
${hasTasks ? '✅' : '⬜'} 4. Tasks generated (\`speckit_tasks\`)

${!hasSpec ? '**Next step**: Run `speckit_specify` with a feature description.' : ''}
${hasSpec && !hasPlan ? '**Next step**: Run `speckit_plan` with tech context.' : ''}
${hasPlan && !hasTasks ? '**Next step**: Run `speckit_tasks`.' : ''}
${hasTasks ? '**Next step**: Run `speckit_implement` to get the next task for Copilot.' : ''}`,
      },
    ],
  };
}

async function getAllFeaturesStatus(): Promise<{ content: [{ type: 'text'; text: string }] }> {
  const features = await listFeatures();

  if (features.length === 0) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `No features found in .specify/specs/\n\nRun \`speckit_init\` to initialize the project, then \`speckit_specify\` to create your first feature.`,
        },
      ],
    };
  }

  const statusLines: string[] = [`## Project Features (${features.length} total)`, ''];

  for (const feature of features) {
    const artifacts = getFeatureArtifacts(feature);
    const hasSpec = artifacts.includes('spec.md');
    const hasPlan = artifacts.includes('plan.md');
    const hasTasks = artifacts.includes('tasks.md');

    let progressStr = '—';
    if (hasTasks) {
      const tasksContent = await readSpecFile(feature, 'tasks.md');
      if (tasksContent) {
        const tasks = parseTaskStatus(tasksContent);
        const p = calculateProgress(tasks);
        progressStr = `${p.percentage}% (${p.completed}/${p.total})`;
      }
    }

    const stages = [
      hasSpec ? 'spec' : '',
      hasPlan ? 'plan' : '',
      hasTasks ? 'tasks' : '',
    ].filter(Boolean);

    statusLines.push(
      `### ${feature}`,
      `Stages: ${stages.join(' → ') || 'not started'} | Progress: ${progressStr}`,
      ''
    );
  }

  const constitution = await readConstitution();
  const copilotInstructions = await readCopilotInstructions();

  statusLines.push('---');
  statusLines.push(`**Constitution**: ${constitution ? '✅ Defined' : '❌ Not created — run speckit_constitution'}`);
  statusLines.push(`**Copilot instructions**: ${copilotInstructions ? '✅ Active' : '❌ Not generated — run speckit_implement'}`);

  return {
    content: [
      {
        type: 'text' as const,
        text: statusLines.join('\n'),
      },
    ],
  };
}
