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
      if (line.startsWith('## Core Principles')) {
        inPrinciples = true;
        continue;
      }
      if (inPrinciples && line.startsWith('## ') && !line.startsWith('## Core')) {
        break;
      }
      if (inPrinciples) {
        principleLines.push(line);
      }
    }
    constitutionSection = principleLines.join('\n').trim();
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
    taskSection = `## Current Task
**${opts.taskId}**: ${opts.taskDescription}${opts.targetFile ? `\nFile: ${opts.targetFile}` : ''}${opts.userStory ? `\nUser Story: ${opts.userStory}` : ''}`;
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

  // DO NOT rules
  const doNotRules = opts.doNotRules ?? [
    'Skip writing tests if the constitution requires them',
    'Change files outside the scope of the current task',
    'Modify spec files (those are managed by the architect)',
    'Introduce new dependencies without updating the plan',
  ];

  const doNotSection = `## DO NOT
${doNotRules.map((r) => `- ${r}`).join('\n')}`;

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
