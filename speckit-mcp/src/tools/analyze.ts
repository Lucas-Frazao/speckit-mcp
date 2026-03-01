import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readSpecFile, getFeatureDir, fileExists } from '../lib/filesystem.js';
import { parseTaskStatus } from '../lib/utils.js';
import type { AnalysisIssue, AnalysisResult } from '../types.js';

export function registerAnalyzeTool(server: McpServer): void {
  server.registerTool(
    'speckit_analyze',
    {
      description:
        'Quality gate for a feature. Reads spec.md, plan.md, and tasks.md and checks for unfilled placeholders, missing sections, [NEEDS CLARIFICATION] markers, incomplete tasks, and missing user story coverage. Returns a structured analysis with issues and a needsRevision flag. Run after speckit_tasks and after implementation to decide whether to re-run a phase.',
      inputSchema: {
        featureName: z.string().describe('The feature directory name (e.g. "001-user-auth")'),
      },
    },
    async ({ featureName }) => {
      const featureDir = getFeatureDir(featureName);

      if (!fileExists(featureDir)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Feature "${featureName}" not found. Run speckit_specify to create it first.`,
            },
          ],
        };
      }

      const specContent = await readSpecFile(featureName, 'spec.md');
      const planContent = await readSpecFile(featureName, 'plan.md');
      const tasksContent = await readSpecFile(featureName, 'tasks.md');

      const issues: AnalysisIssue[] = [];

      // Analyze spec.md
      if (!specContent) {
        issues.push({
          severity: 'critical',
          message: 'spec.md does not exist',
          file: 'spec.md',
          fix: 'Run speckit_specify to generate spec.md',
        });
      } else {
        analyzeSpecFile(specContent, issues);
      }

      // Analyze plan.md
      if (!planContent) {
        issues.push({
          severity: 'critical',
          message: 'plan.md does not exist',
          file: 'plan.md',
          fix: 'Run speckit_plan to generate plan.md',
        });
      } else {
        analyzePlanFile(planContent, issues);
      }

      // Analyze tasks.md
      if (!tasksContent) {
        issues.push({
          severity: 'warning',
          message: 'tasks.md does not exist',
          file: 'tasks.md',
          fix: 'Run speckit_tasks to generate tasks.md',
        });
      } else {
        analyzeTasksFile(tasksContent, issues);

        // Cross-check: user stories in spec vs phases in tasks
        if (specContent) {
          crossCheckUserStoryCoverage(specContent, tasksContent, issues);
        }
      }

      // Determine if revision is needed
      const needsRevision = issues.some((i) => i.severity === 'critical' || i.severity === 'warning');

      const result: AnalysisResult = {
        issues,
        needsRevision,
        summary: buildAnalysisSummary(featureName, issues, needsRevision),
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: formatAnalysisResult(result),
          },
        ],
      };
    }
  );
}

// ── Spec analysis ──────────────────────────────────────────────────────────────

function analyzeSpecFile(content: string, issues: AnalysisIssue[]): void {
  checkPlaceholders(content, 'spec.md', issues);
  checkNeedsClarification(content, 'spec.md', issues);

  // Required sections
  const requiredSections = ['## Overview', '## User Stories'];
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      issues.push({
        severity: 'warning',
        message: `spec.md is missing section: "${section}"`,
        file: 'spec.md',
        fix: `Add a "${section}" section to spec.md with appropriate content`,
      });
    }
  }

  // Check user stories have acceptance criteria
  const storyMatches = content.match(/### User Story \d+/g) ?? [];
  const scenarioMatches = content.match(/\*\*Given\*\*/g) ?? [];

  if (storyMatches.length > 0 && scenarioMatches.length === 0) {
    issues.push({
      severity: 'warning',
      message: 'User stories in spec.md have no acceptance scenarios (Given/When/Then)',
      file: 'spec.md',
      fix: 'Add acceptance scenarios to each user story using Given/When/Then format',
    });
  }

  // Check for empty user story descriptions
  const emptyStory = content.match(/### User Story \d+[^\n]*\n\s*\n\s*###/);
  if (emptyStory) {
    issues.push({
      severity: 'critical',
      message: 'One or more user stories in spec.md appear to have no content',
      file: 'spec.md',
      fix: 'Fill in each user story with a description, acceptance criteria, and scenarios',
    });
  }
}

// ── Plan analysis ──────────────────────────────────────────────────────────────

function analyzePlanFile(content: string, issues: AnalysisIssue[]): void {
  checkPlaceholders(content, 'plan.md', issues);
  checkNeedsClarification(content, 'plan.md', issues);

  // Required sections
  const requiredSections = ['## Technical Context', '## Architecture'];
  for (const section of requiredSections) {
    if (!content.includes(section)) {
      issues.push({
        severity: 'warning',
        message: `plan.md is missing section: "${section}"`,
        file: 'plan.md',
        fix: `Add a "${section}" section to plan.md`,
      });
    }
  }

  // Check tech context is filled in (not just template headings)
  if (content.includes('## Technical Context')) {
    const tcMatch = content.match(/## Technical Context\n([\s\S]*?)(?=\n## |$)/);
    if (tcMatch) {
      const tcBody = tcMatch[1];
      const filledFields = (tcBody.match(/\*\*[^*]+\*\*:\s*[^\n]+/g) ?? []).filter(
        (line) => !line.includes('TBD') && !line.includes('[') && line.split(':')[1]?.trim() !== ''
      );
      if (filledFields.length < 2) {
        issues.push({
          severity: 'critical',
          message: 'plan.md Technical Context section appears unfilled (fewer than 2 populated fields)',
          file: 'plan.md',
          fix: 'Fill in Language, Framework, Project Type, and other relevant fields in the Technical Context section',
        });
      }
    }
  }
}

// ── Tasks analysis ─────────────────────────────────────────────────────────────

function analyzeTasksFile(content: string, issues: AnalysisIssue[]): void {
  checkPlaceholders(content, 'tasks.md', issues);

  const tasks = parseTaskStatus(content);

  if (tasks.length === 0) {
    issues.push({
      severity: 'critical',
      message: 'tasks.md has no parseable tasks',
      file: 'tasks.md',
      fix: 'Re-run speckit_tasks to regenerate tasks.md with proper task format',
    });
    return;
  }

  // Check for tasks with no description
  const emptyTasks = tasks.filter((t) => !t.description || t.description.trim() === '');
  if (emptyTasks.length > 0) {
    issues.push({
      severity: 'warning',
      message: `${emptyTasks.length} task(s) in tasks.md have empty descriptions`,
      file: 'tasks.md',
      fix: 'Add meaningful descriptions to all tasks',
    });
  }

  // Info: count incomplete tasks
  const incomplete = tasks.filter((t) => !t.completed);
  if (incomplete.length > 0) {
    issues.push({
      severity: 'info',
      message: `${incomplete.length} of ${tasks.length} tasks are not yet complete`,
      file: 'tasks.md',
      fix: `Run speckit_implement to get the next task, then implement it`,
    });
  }
}

// ── Cross-checks ───────────────────────────────────────────────────────────────

function crossCheckUserStoryCoverage(
  specContent: string,
  tasksContent: string,
  issues: AnalysisIssue[]
): void {
  // Find user story numbers in spec
  const specStories = new Set<string>();
  const specStoryMatches = specContent.match(/### User Story (\d+)/g) ?? [];
  for (const m of specStoryMatches) {
    const num = m.match(/(\d+)/)?.[1];
    if (num) specStories.add(`US${num}`);
  }

  if (specStories.size === 0) return;

  // Find user story references in tasks
  const taskStories = new Set<string>();
  const taskStoryMatches = tasksContent.match(/\[US(\d+)\]/g) ?? [];
  for (const m of taskStoryMatches) {
    taskStories.add(m.replace(/[\[\]]/g, ''));
  }

  // Check for uncovered stories
  for (const story of specStories) {
    if (!taskStories.has(story)) {
      issues.push({
        severity: 'warning',
        message: `User story ${story} from spec.md has no corresponding tasks in tasks.md`,
        file: 'tasks.md',
        fix: `Add tasks tagged [${story}] for the ${story} user story in tasks.md`,
      });
    }
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function checkPlaceholders(content: string, file: string, issues: AnalysisIssue[]): void {
  // Common placeholder patterns
  const placeholderPatterns = [
    /\[INSERT\s[^\]]+\]/gi,
    /\[TODO[^\]]*\]/gi,
    /\[PLACEHOLDER[^\]]*\]/gi,
    /\[FILL\s[^\]]+\]/gi,
    /<<[^>]+>>/g,
    /\{\{[^}]+\}\}/g,
  ];

  for (const pattern of placeholderPatterns) {
    const matches = content.match(pattern) ?? [];
    if (matches.length > 0) {
      issues.push({
        severity: 'critical',
        message: `${file} contains ${matches.length} unfilled placeholder(s): ${matches.slice(0, 3).join(', ')}${matches.length > 3 ? '...' : ''}`,
        file,
        fix: `Replace all placeholder markers in ${file} with real content`,
      });
      break; // One issue per file is enough for placeholders
    }
  }
}

function checkNeedsClarification(content: string, file: string, issues: AnalysisIssue[]): void {
  const count = (content.match(/\[NEEDS CLARIFICATION\]/gi) ?? []).length;
  if (count > 0) {
    issues.push({
      severity: 'warning',
      message: `${file} has ${count} [NEEDS CLARIFICATION] marker(s)`,
      file,
      fix: `Resolve all [NEEDS CLARIFICATION] markers in ${file} before proceeding`,
    });
  }
}

// ── Output formatting ──────────────────────────────────────────────────────────

function buildAnalysisSummary(
  featureName: string,
  issues: AnalysisIssue[],
  needsRevision: boolean
): string {
  const critical = issues.filter((i) => i.severity === 'critical').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const infos = issues.filter((i) => i.severity === 'info').length;

  if (!needsRevision && infos === 0) {
    return `Feature "${featureName}" passed all quality checks — ready to implement.`;
  }
  if (!needsRevision) {
    return `Feature "${featureName}" has ${infos} informational note(s) but is ready to proceed.`;
  }
  return `Feature "${featureName}" needs revision: ${critical} critical issue(s), ${warnings} warning(s).`;
}

function formatAnalysisResult(result: AnalysisResult): string {
  const lines: string[] = ['# Analysis Result', ''];

  lines.push(`**Status**: ${result.needsRevision ? '❌ Needs Revision' : '✅ Looks Good'}`);
  lines.push(`**Summary**: ${result.summary}`);
  lines.push('');

  if (result.issues.length === 0) {
    lines.push('No issues found.');
    return lines.join('\n');
  }

  const critical = result.issues.filter((i) => i.severity === 'critical');
  const warnings = result.issues.filter((i) => i.severity === 'warning');
  const infos = result.issues.filter((i) => i.severity === 'info');

  if (critical.length > 0) {
    lines.push('## Critical Issues');
    for (const issue of critical) {
      lines.push(`- **[${issue.file}]** ${issue.message}`);
      lines.push(`  - Fix: ${issue.fix}`);
    }
    lines.push('');
  }

  if (warnings.length > 0) {
    lines.push('## Warnings');
    for (const issue of warnings) {
      lines.push(`- **[${issue.file}]** ${issue.message}`);
      lines.push(`  - Fix: ${issue.fix}`);
    }
    lines.push('');
  }

  if (infos.length > 0) {
    lines.push('## Info');
    for (const issue of infos) {
      lines.push(`- **[${issue.file}]** ${issue.message}`);
      lines.push(`  - Note: ${issue.fix}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
