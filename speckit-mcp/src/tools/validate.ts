import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readSpecFile } from '../lib/filesystem.js';
import { parseTaskStatus } from '../lib/utils.js';
import type { ValidationResult } from '../types.js';

export function registerValidateTool(server: McpServer): void {
  server.registerTool(
    'speckit_validate',
    {
      description:
        'Check a feature artifact (spec, plan, tasks, or all) for completeness and quality. Reports unfilled placeholders, missing required sections, and structural issues.',
      inputSchema: {
        featureName: z.string().describe('The feature directory name (e.g. "001-user-auth")'),
        artifact: z
          .enum(['spec', 'plan', 'tasks', 'all'])
          .describe('Which artifact to validate'),
      },
    },
    async ({ featureName, artifact }) => {
      const results: Record<string, ValidationResult> = {};

      if (artifact === 'spec' || artifact === 'all') {
        results.spec = await validateSpec(featureName);
      }
      if (artifact === 'plan' || artifact === 'all') {
        results.plan = await validatePlan(featureName);
      }
      if (artifact === 'tasks' || artifact === 'all') {
        results.tasks = await validateTasks(featureName);
      }

      const allIssues: string[] = [];
      for (const [key, result] of Object.entries(results)) {
        if (!result.valid) {
          allIssues.push(`\n### ${key.toUpperCase()}`);
          allIssues.push(...result.issues.map((i) => `- ❌ ${i}`));
        } else {
          allIssues.push(`\n### ${key.toUpperCase()}\n✅ Valid — no issues found`);
        }
      }

      const overallValid = Object.values(results).every((r) => r.valid);

      return {
        content: [
          {
            type: 'text' as const,
            text: `## Validation Report: ${featureName} (${artifact})

**Overall**: ${overallValid ? '✅ PASS' : '❌ FAIL'}

${allIssues.join('\n')}

${overallValid
  ? '\n✅ All artifacts pass validation. Ready to proceed.'
  : '\n⚠️ Fix the issues above before proceeding to the next phase.'}`,
          },
        ],
      };
    }
  );
}

async function validateSpec(featureName: string): Promise<ValidationResult> {
  const content = await readSpecFile(featureName, 'spec.md');
  const issues: string[] = [];

  if (!content) {
    return { valid: false, issues: ['spec.md not found'] };
  }

  // Check for unfilled template placeholders
  const placeholders = content.match(/\[[A-Z][^\]]{2,}\]/g) ?? [];
  for (const p of placeholders) {
    // Ignore known format markers
    if (p.match(/^\[(US\d+|P\d?|T\d+|FEATURE|###-feature|DATE)\]/)) continue;
    issues.push(`Unfilled placeholder: ${p}`);
  }

  // Check for [NEEDS CLARIFICATION] markers
  const clarifications = content.match(/\[NEEDS CLARIFICATION[^\]]*\]/g) ?? [];
  for (const c of clarifications) {
    issues.push(`Unresolved clarification: ${c}`);
  }

  // Check required sections
  const required = [
    { pattern: /## User Scenarios/, label: 'User Scenarios section' },
    { pattern: /\*\*Given\*\*/, label: 'At least one Given/When/Then acceptance scenario' },
    { pattern: /## Requirements/, label: 'Requirements section' },
    { pattern: /### Functional Requirements/, label: 'Functional Requirements subsection' },
    { pattern: /FR-\d{3}/, label: 'At least one Functional Requirement (FR-001 format)' },
    { pattern: /## Success Criteria/, label: 'Success Criteria section' },
    { pattern: /SC-\d{3}/, label: 'At least one Success Criterion (SC-001 format)' },
  ];

  for (const { pattern, label } of required) {
    if (!pattern.test(content)) {
      issues.push(`Missing: ${label}`);
    }
  }

  // Check status
  if (content.includes('Status: Draft')) {
    issues.push('Status is still Draft — has spec been reviewed?');
  }

  return { valid: issues.length === 0, issues };
}

async function validatePlan(featureName: string): Promise<ValidationResult> {
  const content = await readSpecFile(featureName, 'plan.md');
  const issues: string[] = [];

  if (!content) {
    return { valid: false, issues: ['plan.md not found — run speckit_plan first'] };
  }

  // Check for unfilled template placeholders
  const placeholders = content.match(/\[e\.g\.[^\]]+\]/g) ?? [];
  for (const p of placeholders) {
    issues.push(`Unfilled tech context placeholder: ${p}`);
  }

  // Check tech context is filled
  const techContextMatch = content.match(/## Technical Context\n([\s\S]*?)(?=\n## |$)/);
  if (techContextMatch) {
    const tcLines = techContextMatch[1];
    if (tcLines.includes('[e.g.,') || tcLines.includes('[domain-specific')) {
      issues.push('Technical Context has unfilled template values');
    }
  } else {
    issues.push('Missing Technical Context section');
  }

  // Check summary is filled
  if (content.includes('[Extract from feature spec')) {
    issues.push('Summary section is unfilled');
  }

  // Check constitution check is filled
  if (content.includes('[List constitution')) {
    issues.push('Constitution Check section is unfilled');
  }

  // Check project structure is documented
  if (content.includes('[Document the selected')) {
    issues.push('Project Structure section is undocumented');
  }

  return { valid: issues.length === 0, issues };
}

async function validateTasks(featureName: string): Promise<ValidationResult> {
  const content = await readSpecFile(featureName, 'tasks.md');
  const issues: string[] = [];

  if (!content) {
    return { valid: false, issues: ['tasks.md not found — run speckit_tasks first'] };
  }

  const tasks = parseTaskStatus(content);

  // Check tasks exist
  if (tasks.length === 0) {
    return { valid: false, issues: ['No tasks found in tasks.md'] };
  }

  // Check task IDs are sequential
  const ids = tasks.map((t) => t.id);
  const idNums = ids.map((id) => parseInt(id.replace('T', ''), 10));
  for (let i = 0; i < idNums.length; i++) {
    if (i > 0 && idNums[i] !== idNums[i - 1] + 1) {
      issues.push(`Task ID gap: expected T${String(idNums[i - 1] + 1).padStart(3, '0')} before ${ids[i]}`);
    }
  }

  // Check phases exist
  const phases = new Set(tasks.map((t) => t.phase));
  if (phases.size < 2) {
    issues.push('Tasks should be organized into at least 2 phases');
  }

  // Check for checkpoints
  const tasksContent = content;
  if (!tasksContent.includes('Checkpoint')) {
    issues.push('No checkpoints defined — add checkpoint markers between phases');
  }

  // Check for template placeholder text
  const templateTexts = ['[Title]', '[Brief description]', '[How to verify]'];
  for (const t of templateTexts) {
    if (tasksContent.includes(t)) {
      issues.push(`Unfilled template placeholder: ${t}`);
    }
  }

  return { valid: issues.length === 0, issues };
}
