# Project Agent Instructions

This project uses **Spec-Driven Development (SDD)** powered by the SpecKit MCP server.

## Architecture
- **Lead Architect**: Perplexity AI (created the roadmap, constitution, and initial specifications)
- **Builder**: GitHub Copilot (you) — executes the roadmap autonomously using SpecKit MCP tools
- **Spec Engine**: SpecKit MCP Server — manages spec files, git branches, task tracking, and workflow state

## Project Structure
```
.specify/
├── memory/
│   └── constitution.md      ← Project governing principles (DO NOT MODIFY)
├── roadmap.md               ← Feature roadmap with execution order (update status only)
└── specs/
    └── NNN-feature-name/    ← Per-feature spec artifacts
        ├── spec.md           ← Feature specification
        ├── plan.md           ← Implementation plan
        ├── tasks.md          ← Task breakdown
        ├── data-model.md     ← Entity definitions (if applicable)
        └── contracts/        ← API contracts (if applicable)
.github/
├── copilot-instructions.md  ← Auto-generated per-task context
└── agents/
    └── speckit-builder.agent.md  ← The autonomous builder agent
```

## How to Build This Project
1. Select the **speckit-builder** agent
2. Say: "Execute the roadmap"
3. The agent will autonomously build every feature

## Rules
- The constitution is LAW — all code must comply
- The roadmap defines execution order — respect feature dependencies
- Every feature goes through: specify → plan → tasks → analyze → implement
- No feature is complete until `speckit_analyze` returns `needsRevision: false`
- Git commits happen after each completed task
