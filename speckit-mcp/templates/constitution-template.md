# [PROJECT_NAME] Constitution

## Mandatory Principles (SpecKit Enforced)

> These principles are automatically enforced by the SpecKit MCP server.
> They cannot be removed or overridden by project-specific principles.

### Test-Driven Development (TDD-First)
All features MUST have tests written BEFORE implementation code. The workflow is: write failing test → write minimal code to pass → refactor. No implementation task may begin until its corresponding test task is complete. Tests define the contract; implementation fulfills it.

### Modular Architecture
Every module, function, and component MUST have a single, well-defined responsibility. Code MUST be organized into small, composable units with explicit interfaces. Dependencies between modules MUST be minimized and documented. No god objects, no monolithic files, no tight coupling.

### YAGNI (You Aren't Gonna Need It)
Do NOT build features, abstractions, or infrastructure that are not required by the current task. No speculative generality. No premature optimization. No "we might need this later" code. If it's not in the spec, it doesn't get built. Every line of code must justify its existence against a concrete requirement.

### Clarification Over Assumption
When ANY ambiguity exists — in requirements, design decisions, naming, scope, edge cases, or technical approach — the developer MUST stop and ask for clarification. NEVER assume intent. NEVER guess at requirements. NEVER infer unstated behavior. If a decision is not explicitly documented in the spec, plan, or constitution, it requires explicit human input before proceeding.

## Project-Specific Principles

### [PRINCIPLE_1_NAME]
[PRINCIPLE_1_DESCRIPTION]

### [PRINCIPLE_2_NAME]
[PRINCIPLE_2_DESCRIPTION]

### [PRINCIPLE_3_NAME]
[PRINCIPLE_3_DESCRIPTION]

## Governance
[GOVERNANCE_RULES]

**Version**: 1.0 | **Ratified**: [DATE]
