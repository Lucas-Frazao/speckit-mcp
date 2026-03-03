# Project Instructions

This project is built using Spec-Driven Development.
See `.specify/roadmap.md` for the feature roadmap.
See `.specify/memory/constitution.md` for governing principles.

The SpecKit MCP server manages all specification artifacts.
Use the speckit-builder agent to autonomously execute the roadmap.

## Mandatory Development Rules

### TDD-First
- Write tests BEFORE implementation code — always.
- No implementation task may begin until its corresponding test task is complete.
- Tests define the contract; implementation fulfills it.

### Modular Architecture
- Every module/function has a single responsibility.
- Small, composable units with explicit interfaces.
- No god objects, no monolithic files.

### YAGNI (You Aren't Gonna Need It)
- Build only what the current spec requires. Nothing more.
- No speculative generality. No premature optimization.
- If it's not in the spec, it doesn't get built.

### Clarification Over Assumption
- **When in doubt, STOP and ASK.** Never guess at requirements or behavior.
- If a decision is ambiguous, request explicit human input before proceeding.
- Never say "I'll assume X unless you say otherwise" — that is NOT asking.
- Present specific questions with options when possible.
- Wait for an explicit answer before continuing.
