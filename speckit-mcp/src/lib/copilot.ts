import * as path from 'path';
import {
  getProjectRoot,
  readConstitution,
  readSpecFile,
  writeCopilotInstructions,
} from './filesystem.js';
import type { TechContext } from '../types.js';

export interface CopilotGenerationOptions {
  projectName?: string;
  featureName: string;
  featureNumber?: string;
  status?: string;
  techContext?: TechContext;
  taskId?: string;
  taskDescription?: string;
  targetFile?: string;
  acceptanceCriteria?: string[];
  dependencies?: string[];
  userStory?: string;
  architectureDecisions?: string;
  doNotRules?: string[];
}

export async function generateCopilotInstructions(opts: CopilotGenerationOptions): Promise<string> {
  const projectRoot = getProjectRoot();
  const projectName = opts.projectName ?? path.basename(projectRoot);

  // Read supporting docs
  const constitution = await readConstitution();
  const spec = await readSpecFile(opts.featureName, 'spec.md');
  const plan = await readSpecFile(opts.featureName, 'plan.md');

  // Extract constitution principles section
  let constitutionSection = '';
  if (constitution) {
    const lines = constitution.split('\n');
    const principleLines: string[] = [];
    let inPrinciples = false;
    for (const line of lines) {
      if (line.startsWith('## Core Principles') || line.startsWith('## Mandatory Principles')) {
        inPrinciples = true;
        continue;
      }
      if (inPrinciples && line.startsWith('## ') && !line.startsWith('## Core') && !line.startsWith('## Mandatory')) {
        break;
      }
      if (inPrinciples) {
        principleLines.push(line);
      }
    }
    constitutionSection = principleLines.join('\n').trim();

    // Also capture project-specific principles
    const projectPrincipleLines: string[] = [];
    let inProjectPrinciples = false;
    for (const line of lines) {
      if (line.startsWith('## Project-Specific Principles')) {
        inProjectPrinciples = true;
        continue;
      }
      if (inProjectPrinciples && line.startsWith('## ')) {
        break;
      }
      if (inProjectPrinciples) {
        projectPrincipleLines.push(line);
      }
    }
    if (projectPrincipleLines.length > 0) {
      constitutionSection += '\n\n### Project-Specific Principles\n' + projectPrincipleLines.join('\n').trim();
    }
  }

  // Extract acceptance criteria from spec
  let acceptanceCriteria = opts.acceptanceCriteria ?? [];
  if (acceptanceCriteria.length === 0 && spec) {
    const scenarioMatches = spec.matchAll(/\d+\.\s+\*\*Given\*\*.*?\*\*Then\*\*[^\n]*/g);
    for (const match of scenarioMatches) {
      acceptanceCriteria.push(match[0].trim());
    }
  }

  // Extract architecture decisions from plan
  let archDecisions = opts.architectureDecisions ?? '';
  if (!archDecisions && plan) {
    const archMatch = plan.match(/## Architecture[^\n]*\n([\s\S]*?)(?=\n## |\n#[^#]|$)/);
    if (archMatch) {
      archDecisions = archMatch[1].trim();
    }
  }

  // Tech stack section
  let techSection = '';
  if (opts.techContext) {
    const tc = opts.techContext;
    techSection = `## Tech Stack
- Language: ${tc.language}
- Framework: ${tc.framework}
- Storage: ${tc.storage ?? 'N/A'}
- Testing: ${tc.testing ?? 'N/A'}
- Target Platform: ${tc.platform ?? 'N/A'}
- Project Type: ${tc.projectType}`;
  } else if (plan) {
    // Try to extract from plan
    const tcMatch = plan.match(/## Technical Context\n([\s\S]*?)(?=\n## |$)/);
    if (tcMatch) {
      techSection = `## Tech Stack\n${tcMatch[1].trim()}`;
    }
  }

  // Current task section
  let taskSection = '';
  if (opts.taskId && opts.taskDescription) {
    const isTestTask = opts.taskDescription.includes('[TEST]');
    taskSection = `## Current Task
**${opts.taskId}**: ${opts.taskDescription}${opts.targetFile ? `\nFile: ${opts.targetFile}` : ''}${opts.userStory ? `\nUser Story: ${opts.userStory}` : ''}${isTestTask ? '\n\n**THIS IS A TEST TASK**: Write the test FIRST. The test defines expected behavior. Implementation comes later.' : ''}`;
  }

  // Acceptance criteria section
  let acSection = '';
  if (acceptanceCriteria.length > 0) {
    acSection = `## Acceptance Criteria\n${acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`;
  }

  // Dependencies section
  let depsSection = '';
  if (opts.dependencies && opts.dependencies.length > 0) {
    depsSection = `## Implementation Notes\n- This task depends on: ${opts.dependencies.join(', ')}`;
  }

  // DO NOT rules — expanded with clarification enforcement
  const doNotRules = opts.doNotRules ?? [
    'Skip writing tests — tests are MANDATORY and come FIRST (TDD)',
    'Change files outside the scope of the current task',
    'Modify spec files (those are managed by the architect)',
    'Introduce new dependencies without updating the plan',
    'Build anything not explicitly required by the current task (YAGNI)',
    'Create utility functions, helper classes, or abstractions "for later"',
    'Add configuration options that are not required by the spec',
  ];

  const doNotSection = `## DO NOT
${doNotRules.map((r) => `- ${r}`).join('\n')}`;

  // ── CRITICAL: Forced clarification section ──────────────────────────────────
  const clarificationSection = `## MANDATORY: Clarification Over Assumption

**YOU MUST ASK QUESTIONS — NEVER ASSUME.**

Before making ANY decision that is not explicitly documented in the spec, plan, or constitution, you MUST:

1. **STOP** what you are doing
2. **ASK** the user a specific question about the ambiguity
3. **WAIT** for an explicit answer before proceeding

### When to ask (non-exhaustive):
- The spec says "handle errors appropriately" but doesn't specify HOW → ASK
- The spec mentions a feature but doesn't define the data format → ASK
- You're choosing between two valid approaches → ASK
- The naming convention isn't specified → ASK
- Edge case behavior isn't documented → ASK
- You're unsure if a dependency is acceptable → ASK
- The UI/UX behavior isn't detailed → ASK
- Performance requirements are vague → ASK
- Security requirements are unclear → ASK
- You want to add something "nice to have" → DON'T (YAGNI), and ASK if unsure

### How to ask:
- Be specific: "The spec requires user authentication but doesn't specify the token format. Should I use JWT or session-based tokens?"
- Provide options when possible: "For the database schema, I see two approaches: (A) normalized with join tables, or (B) denormalized for read performance. Which do you prefer?"
- Never proceed with a guess disguised as a question: "I'll use JWT unless you say otherwise" ← THIS IS NOT ASKING

### Consequences:
- If you make an assumption and it's wrong, the implementation will be rejected
- It is ALWAYS better to ask a "dumb" question than to assume incorrectly
- Speed of implementation is LESS important than correctness of implementation`;

  const sections = [
    `# Project: ${projectName}`,
    `# Architecture governed by Spec-Driven Development (SpecKit)`,
    '',
    `## Current Feature: ${opts.featureName}`,
    `Status: ${opts.status ?? 'In Progress'}`,
    '',
    techSection,
    '',
    constitutionSection
      ? `## Constitution (Governing Principles)\n${constitutionSection}`
      : '',
    '',
    clarificationSection,
    '',
    taskSection,
    '',
    acSection,
    '',
    depsSection,
    '',
    archDecisions ? `## Architecture Decisions\n${archDecisions}` : '',
    '',
    doNotSection,
  ]
    .filter((s) => s !== undefined)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const filePath = await writeCopilotInstructions(sections);
  return filePath;
}
