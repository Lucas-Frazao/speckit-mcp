import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readSpecFile, fileExists, getFeatureDir } from '../lib/filesystem.js';
import { parseTaskStatus, calculateProgress } from '../lib/utils.js';
import type { ExecutionStep } from '../types.js';

const techContextSchema = z.object({
  language: z.string().describe('Programming language (e.g. TypeScript, Python, Go)'),
  framework: z.string().describe('Primary framework (e.g. Express, FastAPI, Next.js)'),
  storage: z.string().optional().describe('Storage/database (e.g. PostgreSQL, SQLite, Redis)'),
  testing: z.string().optional().describe('Testing framework (e.g. Vitest, Jest, pytest)'),
  platform: z.string().optional().describe('Deployment platform (e.g. Node.js, Cloudflare Workers)'),
  projectType: z.string().describe('Project type (e.g. api, web-app, cli, library)'),
});

export function registerExecuteFeatureTool(server: McpServer): void {
  server.registerTool(
    'speckit_execute_feature',
    {
      description:
        'Master orchestration tool for autonomous feature execution. Checks the current state of a feature and returns the NEXT ACTION to take — which tool to call, with which arguments, and why. Drives the full spec → plan → tasks → implement → complete loop. Call this repeatedly until featureComplete is true.',
      inputSchema: {
        featureName: z.string().describe('The feature directory name (e.g. "001-user-auth")'),
        featureDescription: z
          .string()
          .describe('Full description of the feature to implement'),
        userStories: z
          .array(z.string())
          .describe('List of user stories for this feature (e.g. ["US1: As a user, I can log in"])'),
        techContext: techContextSchema.describe('Tech stack context for the project'),
      },
    },
    async ({ featureName, featureDescription, userStories, techContext }) => {
      const step = await determineNextStep(featureName, featureDescription, userStories, techContext);

      return {
        content: [
          {
            type: 'text' as const,
            text: formatExecutionStep(step, featureName),
          },
        ],
      };
    }
  );
}

type TechContext = {
  language: string;
  framework: string;
  storage?: string;
  testing?: string;
  platform?: string;
  projectType: string;
};

async function determineNextStep(
  featureName: string,
  featureDescription: string,
  userStories: string[],
  techContext: TechContext
): Promise<ExecutionStep> {
  const featureDir = getFeatureDir(featureName);
  const featureDirExists = fileExists(featureDir);

  // ── State 1: No spec.md ──────────────────────────────────────────────────────
  const specContent = featureDirExists ? await readSpecFile(featureName, 'spec.md') : null;

  if (!specContent) {
    return {
      nextAction: `Call speckit_specify to create the feature specification for "${featureName}".`,
      toolToCall: 'speckit_specify',
      toolArgs: {
        featureName,
        description: featureDescription,
      },
      context: 'No spec.md found. The first step is to generate the spec from the feature description.',
      featureComplete: false,
    };
  }

  // ── State 2: spec.md has unfilled placeholders ───────────────────────────────
  if (hasPlaceholders(specContent)) {
    const storiesFormatted = userStories.map((us, i) => `US${i + 1}: ${us}`).join('\n');
    return {
      nextAction:
        `The spec.md was generated but still has template placeholders. ` +
        `Fill in spec.md directly with complete user stories, acceptance scenarios, requirements, and success criteria based on these user stories:\n\n${storiesFormatted}`,
      toolToCall: undefined,
      toolArgs: undefined,
      context:
        'spec.md exists but contains unfilled placeholders. You must edit the file directly to complete it before planning.',
      featureComplete: false,
    };
  }

  // ── State 3: No plan.md ──────────────────────────────────────────────────────
  const planContent = await readSpecFile(featureName, 'plan.md');

  if (!planContent) {
    return {
      nextAction: `Call speckit_plan to create the technical plan for "${featureName}".`,
      toolToCall: 'speckit_plan',
      toolArgs: {
        featureName,
        techContext,
      },
      context: 'spec.md is complete. The next step is to generate the technical plan.',
      featureComplete: false,
    };
  }

  // ── State 4: plan.md has unfilled placeholders ───────────────────────────────
  if (hasPlaceholders(planContent)) {
    return {
      nextAction:
        `plan.md has unfilled placeholders. Fill in plan.md with concrete architecture decisions, ` +
        `project structure, and technical approach. The tech stack is: ` +
        `${techContext.language} / ${techContext.framework}` +
        (techContext.storage ? ` / ${techContext.storage}` : '') +
        `.`,
      toolToCall: undefined,
      toolArgs: undefined,
      context:
        'plan.md exists but contains unfilled placeholders. Edit the file directly to complete the architecture decisions.',
      featureComplete: false,
    };
  }

  // ── State 5: No tasks.md ─────────────────────────────────────────────────────
  const tasksContent = await readSpecFile(featureName, 'tasks.md');

  if (!tasksContent) {
    return {
      nextAction: `Call speckit_tasks to generate the task breakdown for "${featureName}".`,
      toolToCall: 'speckit_tasks',
      toolArgs: {
        featureName,
      },
      context: 'spec.md and plan.md are complete. The next step is to break the plan into implementable tasks.',
      featureComplete: false,
    };
  }

  // ── State 6: tasks.md exists — run quality gate ──────────────────────────────
  const tasks = parseTaskStatus(tasksContent);
  const progress = calculateProgress(tasks);
  const hasIncompleteTasks = progress.completed < progress.total;

  // Check for critical issues before implementing
  const criticalIssues = findCriticalIssues(specContent, planContent, tasksContent);

  if (criticalIssues.length > 0) {
    return {
      nextAction: `Call speckit_analyze to review quality issues before implementation.`,
      toolToCall: 'speckit_analyze',
      toolArgs: {
        featureName,
      },
      context: `Potential quality issues detected: ${criticalIssues.join('; ')}. Run speckit_analyze to get a full report and fix recommendations.`,
      featureComplete: false,
    };
  }

  // ── State 7: All tasks complete ──────────────────────────────────────────────
  if (!hasIncompleteTasks) {
    return {
      nextAction: `Feature "${featureName}" is fully implemented. Call speckit_update_roadmap to mark it complete.`,
      toolToCall: 'speckit_update_roadmap',
      toolArgs: {
        featureName: featureName,
        newStatus: 'complete',
      },
      context: `All ${progress.total} tasks are complete (100%). Mark this feature as complete in the roadmap.`,
      featureComplete: true,
    };
  }

  // ── State 8: Implement next task ─────────────────────────────────────────────
  const nextIncompleteTask = tasks.find((t) => !t.completed);
  const remainingCount = progress.total - progress.completed;

  return {
    nextAction: `Call speckit_implement to get the next task brief, then implement it. After implementation, call speckit_complete_task to mark it done.`,
    toolToCall: 'speckit_implement',
    toolArgs: {
      featureName,
    },
    context:
      `${progress.completed}/${progress.total} tasks complete (${progress.percentage}%). ` +
      `Next task: ${nextIncompleteTask ? `${nextIncompleteTask.id} — ${nextIncompleteTask.description}` : 'unknown'}. ` +
      `${remainingCount} task(s) remaining.`,
    featureComplete: false,
  };
}

function hasPlaceholders(content: string): boolean {
  const patterns = [
    /\[INSERT\s[^\]]+\]/i,
    /\[TODO[^\]]*\]/i,
    /\[PLACEHOLDER[^\]]*\]/i,
    /\[FILL\s[^\]]+\]/i,
    /<<[^>]+>>/,
    /\{\{[^}]+\}\}/,
  ];
  return patterns.some((p) => p.test(content));
}

function findCriticalIssues(
  specContent: string,
  planContent: string,
  tasksContent: string
): string[] {
  const issues: string[] = [];

  // Check for NEEDS CLARIFICATION markers
  if (/\[NEEDS CLARIFICATION\]/i.test(specContent)) {
    issues.push('spec.md has [NEEDS CLARIFICATION] markers');
  }
  if (/\[NEEDS CLARIFICATION\]/i.test(planContent)) {
    issues.push('plan.md has [NEEDS CLARIFICATION] markers');
  }

  // Check that tasks.md has at least some tasks
  const tasks = parseTaskStatus(tasksContent);
  if (tasks.length === 0) {
    issues.push('tasks.md has no parseable tasks');
  }

  return issues;
}

function formatExecutionStep(step: ExecutionStep, featureName: string): string {
  const lines: string[] = [
    `# Execute Feature: ${featureName}`,
    '',
    `## Next Action`,
    step.nextAction,
    '',
    `## Context`,
    step.context,
  ];

  if (step.toolToCall) {
    lines.push('');
    lines.push(`## Tool to Call`);
    lines.push(`**Tool**: \`${step.toolToCall}\``);
    lines.push('**Arguments**:');
    lines.push('```json');
    lines.push(JSON.stringify(step.toolArgs ?? {}, null, 2));
    lines.push('```');
  } else {
    lines.push('');
    lines.push('## Action Required');
    lines.push('This step requires direct file editing — no tool call needed.');
  }

  lines.push('');
  lines.push(`**Feature Complete**: ${step.featureComplete ? '✅ Yes' : '⬜ Not yet'}`);

  if (!step.featureComplete) {
    lines.push('');
    lines.push('> After completing this step, call `speckit_execute_feature` again to get the next action.');
  }

  return lines.join('\n');
}
