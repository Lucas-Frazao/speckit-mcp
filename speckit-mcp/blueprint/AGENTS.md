# Project Agent Instructions

This project uses **Spec-Driven Development (SDD)** powered by the SpecKit MCP server.

## Architecture

- **Lead Architect**: Perplexity AI (created the roadmap, constitution, and initial specifications)
- **Builder**: GitHub Copilot (you) — executes the roadmap autonomously using SpecKit MCP tools
- **Spec Engine**: SpecKit MCP Server — manages spec files, git branches, task tracking, and workflow state

## Mandatory Principles (Enforced by SpecKit)

These principles are non-negotiable and enforced at every step:

1. **TDD-First**: Write tests BEFORE implementation code. Always. No exceptions.
2. **Modular Architecture**: Single-responsibility modules, composable units, explicit interfaces.
3. **YAGNI**: Build only what the spec requires. No speculative code.
4. **Clarification Over Assumption**: When in doubt, STOP and ASK. Never guess at requirements.

## Project Structure

```
.specify/
├── memory/
│   └── constitution.md      ← Project governing principles (mandatory + project-specific)
├── roadmap.md               ← Feature roadmap with execution order (update status only)
└── specs/
    └── NNN-feature-name/    ← Per-feature spec artifacts
        ├── spec.md           ← Feature specification
        ├── plan.md           ← Implementation plan
        ├── tasks.md          ← Task breakdown (tests BEFORE implementation)
        ├── data-model.md     ← Entity definitions (if applicable)
        └── contracts/        ← API contracts (if applicable)
.github/
├── copilot-instructions.md  ← Auto-generated per-task context (includes clarification rules)
└── agents/
    └── speckit-builder.agent.md  ← The autonomous builder agent
```

## How to Build This Project

1. Select the **speckit-builder** agent
2. Say: "Execute the roadmap"
3. The agent will autonomously build every feature
4. **The agent WILL ask you questions** when anything is ambiguous — answer them

## Rules

- The constitution is LAW — all code must comply with mandatory principles
- The roadmap defines execution order — respect feature dependencies
- Every feature goes through: specify → clarify → plan → tasks → analyze → implement
- **Tests are written BEFORE implementation** (TDD-first, enforced by speckit_implement)
- No feature is complete until `speckit_analyze` returns `needsRevision: false`
- Git commits happen after each completed task
- **When ambiguity exists, the agent MUST ask the user — never assume**
- **YAGNI**: If it's not in the spec, it doesn't get built
