import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readSpecFile, getFeatureDir, fileExists, readConstitution } from '../lib/filesystem.js';
import { parseTaskStatus } from '../lib/utils.js';
import { validateConstitutionHasMandatoryPrinciples } from '../lib/constitution-enforcer.js';
import type { AnalysisIssue, AnalysisResult } from '../types.js';

export function registerAnalyzeTool(server: McpServer): void {
  server.registerTool(
    'speckit_analyze',
    {
      description:
        'Quality gate for a feature. Reads spec.md, plan.md, and tasks.md and checks for unfilled placeholders, missing sections, [NEEDS CLARIFICATION] markers, incomplete tasks, TDD ordering violations, YAGNI violations, modularity issues, and missing user story coverage. Returns a structured analysis with issues and a needsRevision flag. Run after speckit_tasks and after implementation to decide whether to re-run a phase.',
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
      const constitutionContent = await readConstitution();

      const issues: AnalysisIssue[] = [];

      // ── Constitution validation ─────────────────────────────────────────────────
      if (constitutionContent) {
        const missingPrinciples = validateConstitutionHasMandatoryPrinciples(constitutionContent);
        if (missingPrinciples.length > 0) {
          issues.push({
            severity: 'critical',
            message: `Constitution is missing mandatory principles: ${missingPrinciples.join(', ')}`,
            file: 'constitution.md',
            fix: 'Run speckit_constitution to regenerate the constitution with mandatory principles.',
          });
        }
      } else {
        issues.push({
          severity: 'critical',
          message: 'No constitution found. Every project must have a constitution with mandatory principles.',
          file: 'constitution.md',
          fix: 'Run speckit_init or speckit_constitution to create the constitution.',
        });
      }

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

        // TDD ordering check
        checkTddOrdering(tasksContent, issues);

        // YAGNI check
        checkYagniCompliance(tasksContent, specContent, issues);

        // Cross-check: user stories in spec vs phases in tasks
        if (specContent) {
          crossCheckUserStoryCoverage(specContent, tasksContent, issues);
        }
      }

      // Modularity check on plan
      if (planContent) {
        checkModularityCompliance(planContent, issues);
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

  // Check for testing framework specification
  if (!content.toLowerCase().includes('testing')) {
    issues.push({
      severity: 'warning',
      message: 'plan.md does not specify a testing framework — required for TDD-first workflow',
      file: 'plan.md',
      fix: 'Add a Testing field to Technical Context (e.g., vitest, jest, pytest)',
    });
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

  // Check for test setup task in Phase 1
  if (!content.includes('test framework') && !content.includes('test configuration') && !content.includes('Setup test')) {
    issues.push({
      severity: 'warning',
      message: 'tasks.md Phase 1 does not include a test framework setup task',
      file: 'tasks.md',
      fix: 'Add a test framework setup task to Phase 1 (required for TDD-first workflow)',
    });
  }
}

// ── TDD Ordering Check ────────────────────────────────────────────────────────

function checkTddOrdering(content: string, issues: AnalysisIssue[]): void {
  // Check that [TEST] tasks appear before non-test tasks in each phase
  const phases = content.split(/## Phase \d+/);
  for (const phase of phases) {
    if (!phase.trim()) continue;

    const taskLines = phase.match(/- \[[ x]\] \*\*T\d{3}\*\*:.*$/gm) ?? [];
    let lastTestIndex = -1;
    let firstImplIndex = -1;

    for (let i = 0; i < taskLines.length; i++) {
      const line = taskLines[i];
      if (line.includes('[TEST]')) {
        lastTestIndex = i;
        if (firstImplIndex !== -1 && firstImplIndex < i) {
          // Found a test task AFTER an implementation task in the same phase
          issues.push({
            severity: 'critical',
            message: `TDD violation: Test task found after implementation task in same phase. Test tasks must come first.`,
            file: 'tasks.md',
            fix: 'Reorder tasks so all [TEST] tasks appear before implementation tasks within each phase',
          });
          return; // One issue per file is enough
        }
      } else if (!line.includes('Setup test') && !line.includes('Create project') && !line.includes('Initialize project')) {
        if (firstImplIndex === -1) firstImplIndex = i;
      }
    }
  }

  // Check that [TEST] tasks exist at all
  if (!content.includes('[TEST]')) {
    issues.push({
      severity: 'critical',
      message: 'tasks.md has no [TEST] tasks — TDD-first requires test tasks before implementation',
      file: 'tasks.md',
      fix: 'Re-run speckit_tasks to regenerate with [TEST] tasks, or manually add test tasks before each implementation task',
    });
  }
}

// ── YAGNI Compliance ──────────────────────────────────────────────────────────

function checkYagniCompliance(
  tasksContent: string,
  specContent: string | null,
  issues: AnalysisIssue[]
): void {
  if (!specContent) return;

  // Check for common YAGNI violations in tasks
  const yagniPatterns = [
    { pattern: /abstract.*factory/i, label: 'abstract factory pattern' },
    { pattern: /generic.*util/i, label: 'generic utility' },
    { pattern: /future.*proof/i, label: 'future-proofing' },
    { pattern: /plugin.*system/i, label: 'plugin system' },
    { pattern: /extensib/i, label: 'extensibility layer' },
  ];

  for (const { pattern, label } of yagniPatterns) {
    if (pattern.test(tasksContent)) {
      issues.push({
        severity: 'warning',
        message: `Potential YAGNI violation: tasks.md references "${label}" — verify this is required by a specific spec requirement`,
        file: 'tasks.md',
        fix: `Check if "${label}" is directly required by a Functional Requirement (FR-XXX) in spec.md. If not, remove it.`,
      });
    }
  }
}

// ── Modularity Compliance ─────────────────────────────────────────────────────

function checkModularityCompliance(planContent: string, issues: AnalysisIssue[]): void {
  // Check for signs of monolithic design
  const monolithicPatterns = [
    { pattern: /single.*file.*application/i, label: 'single-file application' },
    { pattern: /monolith/i, label: 'monolithic design' },
    { pattern: /god.*class/i, label: 'god class' },
    { pattern: /all.*in.*one/i, label: 'all-in-one module' },
  ];

  for (const { pattern, label } of monolithicPatterns) {
    if (pattern.test(planContent)) {
      issues.push({
        severity: 'warning',
        message: `Potential modularity violation: plan.md references "${label}"`,
        file: 'plan.md',
        fix: `Refactor to use modular architecture: separate concerns into distinct modules with single responsibilities.`,
      });
    }
  }

  // Check that project structure has multiple directories (sign of modularity)
  if (planContent.includes('## Project Structure')) {
    const structMatch = planContent.match(/## Project Structure\n([\s\S]*?)(?=\n## |$)/);
    if (structMatch) {
      const srcDirs = (structMatch[1].match(/src\//g) ?? []).length;
      if (srcDirs < 2) {
        issues.push({
          severity: 'info',
          message: 'Project structure has fewer than 2 src/ subdirectories — consider splitting into modules',
          file: 'plan.md',
          fix: 'Organize code into separate directories by concern (e.g., src/models/, src/services/, src/routes/)',
        });
      }
    }
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

  // Check that each user story has both [TEST] and implementation tasks
  for (const story of taskStories) {
    const storyTasks = tasksContent.match(new RegExp(`\\[${story}\\]`, 'g')) ?? [];
    const storyTestTasks = tasksContent.match(new RegExp(`\\[TEST\\].*\\[${story}\\]|\\[${story}\\].*\\[TEST\\]`, 'g')) ?? [];
    if (storyTasks.length > 0 && storyTestTasks.length === 0) {
      issues.push({
        severity: 'critical',
        message: `User story ${story} has implementation tasks but NO test tasks — TDD-first violation`,
        file: 'tasks.md',
        fix: `Add [TEST] tasks for ${story} BEFORE its implementation tasks`,
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
    return `Feature "${featureName}" passed all quality checks (including TDD, YAGNI, modularity) — ready to implement.`;
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
