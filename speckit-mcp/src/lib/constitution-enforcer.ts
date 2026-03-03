import { getDate } from './utils.js';

/**
 * Mandatory principles that are automatically enforced in every project constitution.
 * These cannot be removed or overridden by project-specific principles.
 */
export const MANDATORY_PRINCIPLES = [
  {
    name: 'Test-Driven Development (TDD-First)',
    shortDescription: 'Write tests before implementation code — always.',
    description:
      'All features MUST have tests written BEFORE implementation code. The workflow is: write failing test → write minimal code to pass → refactor. No implementation task may begin until its corresponding test task is complete. Tests define the contract; implementation fulfills it.',
  },
  {
    name: 'Modular Architecture',
    shortDescription: 'Single-responsibility, composable, loosely-coupled modules.',
    description:
      'Every module, function, and component MUST have a single, well-defined responsibility. Code MUST be organized into small, composable units with explicit interfaces. Dependencies between modules MUST be minimized and documented. No god objects, no monolithic files, no tight coupling.',
  },
  {
    name: 'YAGNI (You Aren\'t Gonna Need It)',
    shortDescription: 'Build only what the current spec requires — nothing more.',
    description:
      'Do NOT build features, abstractions, or infrastructure that are not required by the current task. No speculative generality. No premature optimization. No "we might need this later" code. If it\'s not in the spec, it doesn\'t get built. Every line of code must justify its existence against a concrete requirement.',
  },
  {
    name: 'Clarification Over Assumption',
    shortDescription: 'When in doubt, stop and ask — never guess.',
    description:
      'When ANY ambiguity exists — in requirements, design decisions, naming, scope, edge cases, or technical approach — the developer MUST stop and ask for clarification. NEVER assume intent. NEVER guess at requirements. NEVER infer unstated behavior. If a decision is not explicitly documented in the spec, plan, or constitution, it requires explicit human input before proceeding.',
  },
] as const;

/**
 * Build a complete constitution with mandatory principles always included.
 * Project-specific principles are added after the mandatory section.
 */
export function buildConstitutionWithMandatoryPrinciples(
  projectName: string,
  projectPrinciples: string[]
): string {
  const date = getDate();

  const mandatoryBlocks = MANDATORY_PRINCIPLES.map(
    (p) => `### ${p.name}\n${p.description}`
  ).join('\n\n');

  let projectPrincipleBlocks = '';
  if (projectPrinciples.length > 0) {
    projectPrincipleBlocks = projectPrinciples
      .map((p, i) => {
        const name = p.split(' ').slice(0, 6).join(' ');
        return `### ${name}\n${p}`;
      })
      .join('\n\n');
  }

  return `# ${projectName} Constitution

## Mandatory Principles (SpecKit Enforced)

> These principles are automatically enforced by the SpecKit MCP server.
> They cannot be removed or overridden by project-specific principles.

${mandatoryBlocks}

${projectPrinciples.length > 0 ? `## Project-Specific Principles\n\n${projectPrincipleBlocks}\n\n` : ''}## Governance
All features must have a spec approved before implementation begins. Tests must pass before any implementation task is marked complete. The architect (Claude) manages specs; the developer (Copilot) implements them. When the developer encounters ANY ambiguity, they MUST stop and ask for human clarification — never assume.

**Version**: 1.0 | **Ratified**: ${date}
`;
}

/**
 * Validate that a constitution still contains all mandatory principles.
 * Returns a list of missing mandatory principle names.
 */
export function validateConstitutionHasMandatoryPrinciples(constitutionContent: string): string[] {
  const missing: string[] = [];
  for (const principle of MANDATORY_PRINCIPLES) {
    // Check for the principle name as a header
    if (!constitutionContent.includes(principle.name)) {
      missing.push(principle.name);
    }
  }
  return missing;
}
