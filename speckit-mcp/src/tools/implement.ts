import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readSpecFile, readConstitution } from '../lib/filesystem.js';
import { generateCopilotInstructions } from '../lib/copilot.js';
import { parseTaskStatus, findNextIncompleteTask, calculateProgress, extractFeatureNumber } from '../lib/utils.js';

export function registerImplementTool(server: McpServer): void {
  server.registerTool(
    'speckit_implement',
    {
      description:
        'Generate a focused implementation brief for the next task (or a specific task). Reads all feature context, updates copilot-instructions.md, and returns a brief that GitHub Copilot can execute. Enforces TDD-first: if the next task is an implementation task and its corresponding test task is not yet complete, the test task is returned instead. This is the primary bridge between architect and developer.',
      inputSchema: {
        featureName: z.string().describe('The feature directory name (e.g. "001-user-auth")'),
        taskId: z
          .string()
          .optional()
          .describe(
            'Specific task ID to implement (e.g. "T003"). If not provided, finds the next incomplete task.'
          ),
      },
    },
    async ({ featureName, taskId }) => {
      const specContent = await readSpecFile(featureName, 'spec.md');
      const planContent = await readSpecFile(featureName, 'plan.md');
      const tasksContent = await readSpecFile(featureName, 'tasks.md');
      const dataModelContent = await readSpecFile(featureName, 'data-model.md');
      const constitutionContent = await readConstitution();

      if (!tasksContent) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: No tasks.md found for feature "${featureName}". Run speckit_tasks first.`,
            },
          ],
        };
      }

      const tasks = parseTaskStatus(tasksContent);
      const progress = calculateProgress(tasks);

      // Find the target task
      let targetTask = taskId
        ? tasks.find((t) => t.id === taskId)
        : findNextIncompleteTask(tasks);

      if (!targetTask) {
        if (taskId) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Task ${taskId} not found in tasks.md for feature "${featureName}".`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: `🎉 All tasks complete for **${featureName}**!\n\nProgress: ${progress.completed}/${progress.total} tasks (${progress.percentage}%)\n\nRun \`speckit_validate\` to do a final quality check.`,
            },
          ],
        };
      }

      // ── TDD-First Enforcement ─────────────────────────────────────────────────
      // If this is an implementation task (not a [TEST] task), check if there are
      // incomplete [TEST] tasks in the same phase/user story that should be done first.
      const tddWarning = checkTddPrerequisites(tasks, targetTask, tasksContent);

      if (tddWarning.blockingTestTask) {
        // Override: force the test task to be done first
        targetTask = tddWarning.blockingTestTask;
      }

      // Extract tech context from plan
      const techContext = extractTechContextSummary(planContent);

      // Extract relevant acceptance criteria from spec
      const acceptanceCriteria = extractAcceptanceCriteriaForTask(specContent, targetTask.userStory);

      // Find dependencies (tasks in same phase that aren't marked [P])
      const dependencies = findTaskDependencies(tasks, targetTask);

      // Generate copilot-instructions.md
      const featureNumber = extractFeatureNumber(featureName);
      const copilotPath = await generateCopilotInstructions({
        featureName,
        featureNumber,
        status: 'In Progress',
        taskId: targetTask.id,
        taskDescription: targetTask.description,
        targetFile: targetTask.filePath,
        techContext: techContext ?? undefined,
        acceptanceCriteria,
        dependencies: dependencies.map((t) => `${t.id}: ${t.description}`),
        userStory: targetTask.userStory ?? undefined,
      });

      // Build the next task preview
      const allRemaining = tasks.filter((t) => !t.completed);
      const nextAfterCurrent = allRemaining.find((t) => t.id !== targetTask!.id);

      const isTestTask = targetTask.description.includes('[TEST]') || tasksContent.match(new RegExp(`\\*\\*${targetTask.id}\\*\\*:.*\\[TEST\\]`));

      const implementationBrief = buildImplementationBrief({
        featureName,
        targetTask,
        specContent,
        planContent,
        dataModelContent,
        constitutionContent,
        techContext,
        acceptanceCriteria,
        dependencies,
        progress,
        copilotPath,
        nextTask: nextAfterCurrent ?? null,
        isTestTask: !!isTestTask,
        tddWarning: tddWarning.message,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: implementationBrief,
          },
        ],
      };
    }
  );
}

// ── TDD Prerequisites Check ───────────────────────────────────────────────────

interface TddCheck {
  message: string | null;
  blockingTestTask: ReturnType<typeof parseTaskStatus>[0] | null;
}

function checkTddPrerequisites(
  tasks: ReturnType<typeof parseTaskStatus>,
  targetTask: ReturnType<typeof parseTaskStatus>[0],
  tasksContent: string
): TddCheck {
  // Check if the target task itself is a test task
  const isTestTask = targetTask.description.includes('[TEST]') ||
    tasksContent.match(new RegExp(`\\*\\*${targetTask.id}\\*\\*:.*\\[TEST\\]`));

  if (isTestTask) {
    return { message: null, blockingTestTask: null };
  }

  // This is an implementation task. Check if there are incomplete test tasks
  // in the same phase or for the same user story that should be done first.
  const samePhaseTests = tasks.filter((t) =>
    !t.completed &&
    t.id !== targetTask.id &&
    t.phase === targetTask.phase &&
    (t.description.includes('[TEST]') ||
      tasksContent.match(new RegExp(`\\*\\*${t.id}\\*\\*:.*\\[TEST\\]`)))
  );

  if (samePhaseTests.length > 0) {
    const firstBlockingTest = samePhaseTests[0];
    return {
      message: `⚠️ TDD-FIRST ENFORCEMENT: Implementation task ${targetTask.id} cannot proceed until test task ${firstBlockingTest.id} is complete. Redirecting to the test task.`,
      blockingTestTask: firstBlockingTest,
    };
  }

  return { message: null, blockingTestTask: null };
}

function extractTechContextSummary(planContent: string | null): {
  language: string;
  framework: string;
  storage?: string;
  testing?: string;
  platform?: string;
  projectType: string;
} | null {
  if (!planContent) return null;

  const ctx: Record<string, string> = {};
  const tcMatch = planContent.match(/## Technical Context\n([\s\S]*?)(?=\n## |$)/);
  if (!tcMatch) return null;

  const lines = tcMatch[1].split('\n');
  for (const line of lines) {
    const m = line.match(/\*\*([^*]+)\*\*:\s*(.+)/);
    if (m) {
      ctx[m[1].toLowerCase().trim()] = m[2].trim();
    }
  }

  return {
    language: ctx['language/version'] ?? ctx['language'] ?? 'TypeScript',
    framework: ctx['primary dependencies'] ?? ctx['framework'] ?? 'N/A',
    storage: ctx['storage'],
    testing: ctx['testing'],
    platform: ctx['target platform'] ?? ctx['platform'],
    projectType: ctx['project type'] ?? 'web-app',
  };
}

function extractAcceptanceCriteriaForTask(specContent: string | null, userStory: string | null): string[] {
  if (!specContent) return [];

  // If we have a user story, try to find its section
  if (userStory) {
    const storyNum = userStory.replace('US', '');
    const storyPattern = new RegExp(
      `### User Story ${storyNum}[\\s\\S]*?(?=### User Story |\\n## [^#]|$)`
    );
    const storyMatch = specContent.match(storyPattern);
    if (storyMatch) {
      const scenarios = storyMatch[0].match(/\d+\.\s+\*\*Given\*\*[^\n]*/g) ?? [];
      return scenarios.map((s) => s.trim()).slice(0, 5);
    }
  }

  // Fall back to all scenarios
  const allScenarios = specContent.match(/\d+\.\s+\*\*Given\*\*[^\n]*/g) ?? [];
  return allScenarios.map((s) => s.trim()).slice(0, 5);
}

function findTaskDependencies(tasks: ReturnType<typeof parseTaskStatus>, target: typeof tasks[0]): typeof tasks {
  // Find non-parallel tasks in the same phase that come before this task
  const idx = tasks.findIndex((t) => t.id === target.id);
  return tasks
    .slice(0, idx)
    .filter((t) => !t.parallel && !t.completed && t.phase === target.phase);
}

interface BriefOptions {
  featureName: string;
  targetTask: ReturnType<typeof parseTaskStatus>[0];
  specContent: string | null;
  planContent: string | null;
  dataModelContent: string | null;
  constitutionContent: string | null;
  techContext: ReturnType<typeof extractTechContextSummary>;
  acceptanceCriteria: string[];
  dependencies: ReturnType<typeof parseTaskStatus>;
  progress: { total: number; completed: number; percentage: number };
  copilotPath: string;
  nextTask: ReturnType<typeof parseTaskStatus>[0] | null;
  isTestTask: boolean;
  tddWarning: string | null;
}

function buildImplementationBrief(opts: BriefOptions): string {
  const {
    featureName,
    targetTask,
    techContext,
    acceptanceCriteria,
    dependencies,
    progress,
    copilotPath,
    nextTask,
    isTestTask,
    tddWarning,
  } = opts;

  const lines: string[] = [
    `# Implementation Brief: ${targetTask.id}`,
    `Feature: **${featureName}** | Phase: ${targetTask.phase}`,
    `Progress: ${opts.progress.completed}/${opts.progress.total} tasks (${opts.progress.percentage}%)`,
    '',
  ];

  // TDD warning if redirected
  if (tddWarning) {
    lines.push(`> ${tddWarning}`);
    lines.push('');
  }

  // Test task indicator
  if (isTestTask) {
    lines.push(`## 🧪 TEST TASK (TDD-First)`);
    lines.push(`This is a **test task**. Write the tests FIRST. These tests define the expected behavior.`);
    lines.push(`The corresponding implementation task will make these tests pass.`);
    lines.push('');
  }

  lines.push(
    `## Task`,
    `**${targetTask.id}**: ${targetTask.description}`,
    targetTask.filePath ? `**Target file**: \`${targetTask.filePath}\`` : '',
    targetTask.userStory ? `**User Story**: ${targetTask.userStory}` : '',
    targetTask.parallel ? '**Parallelizable**: Yes — this task can run concurrently with other [P] tasks' : '',
    '',
  );

  if (techContext) {
    lines.push(`## Tech Stack`);
    lines.push(`- Language: ${techContext.language}`);
    lines.push(`- Framework: ${techContext.framework}`);
    if (techContext.storage) lines.push(`- Storage: ${techContext.storage}`);
    if (techContext.testing) lines.push(`- Testing: ${techContext.testing}`);
    lines.push('');
  }

  if (acceptanceCriteria.length > 0) {
    lines.push(`## Acceptance Criteria`);
    for (const criterion of acceptanceCriteria) {
      lines.push(`- ${criterion}`);
    }
    lines.push('');
  }

  if (dependencies.length > 0) {
    lines.push(`## Blocking Dependencies`);
    lines.push(`⚠️ Complete these first:`);
    for (const dep of dependencies) {
      lines.push(`- **${dep.id}**: ${dep.description}`);
    }
    lines.push('');
  }

  if (opts.dataModelContent) {
    lines.push(`## Data Model Reference`);
    lines.push('See `data-model.md` for entity definitions and relationships.');
    lines.push('');
  }

  lines.push(`## Copilot Instructions Updated`);
  lines.push(`\`.github/copilot-instructions.md\` has been updated at: ${copilotPath}`);
  lines.push(`GitHub Copilot will read this file for full context.`);
  lines.push('');

  lines.push(`## For GitHub Copilot`);
  lines.push('The following instructions are now in `.github/copilot-instructions.md`:');

  if (isTestTask) {
    lines.push(`1. **WRITE TESTS** for: ${targetTask.description.replace('[TEST]', '').trim()}`);
    lines.push('2. Tests should define expected behavior before any implementation exists');
    lines.push('3. Use the testing framework specified in the tech stack');
    lines.push('4. Cover happy path, edge cases, and error scenarios');
    lines.push('5. Tests MUST be runnable and initially failing (no implementation yet)');
  } else {
    lines.push(`1. Implement **${targetTask.id}**: ${targetTask.description}`);
    if (targetTask.filePath) {
      lines.push(`2. Create/modify \`${targetTask.filePath}\``);
    }
    lines.push('3. Follow the tech stack and architecture patterns from the plan');
    lines.push('4. All corresponding tests MUST pass after implementation');
    lines.push('5. Only touch files in scope of this task');
  }

  lines.push('');

  // Mandatory rules
  lines.push(`## Mandatory Rules`);
  lines.push('- **YAGNI**: Build ONLY what this task requires. No speculative code.');
  lines.push('- **Modularity**: Keep functions small, single-purpose, loosely coupled.');
  lines.push('- **Clarification**: If ANYTHING is ambiguous, STOP and ask the user. Do NOT assume.');
  lines.push('');

  lines.push(`## After Implementation`);
  lines.push(`Run: \`speckit_complete_task\` with taskId: "${targetTask.id}"`);
  if (nextTask) {
    lines.push(`Next task preview: **${nextTask.id}** — ${nextTask.description}`);
  }

  return lines.filter((l) => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
}
