# Implementation Plan: [FEATURE]

Branch: [###-feature-name] | Date: [DATE] | Spec: [link]

## Summary

[Extract from feature spec: primary requirement + technical approach]

## Technical Context

- **Language/Version**: [e.g., Python 3.11, TypeScript 5.x]
- **Primary Dependencies**: [e.g., FastAPI, React, Express]
- **Storage**: [e.g., PostgreSQL, SQLite, files]
- **Testing**: [e.g., pytest, vitest, jest] ← REQUIRED for TDD-first workflow
- **Target Platform**: [e.g., Linux server, Web, iOS]
- **Project Type**: [e.g., web-app, cli, library, api]
- **Performance Goals**: [domain-specific goals]
- **Constraints**: [domain-specific constraints]

## Constitution Check

GATE: Must pass before implementation.

### Mandatory Principles Compliance
- [ ] **TDD-First**: Testing framework is specified, test tasks will be generated before implementation
- [ ] **Modular Architecture**: Project structure separates concerns into distinct modules
- [ ] **YAGNI**: No speculative components planned beyond spec requirements
- [ ] **Clarification Over Assumption**: All ambiguities have been resolved via speckit_clarify

### Project-Specific Principles Compliance
[List project-specific principle compliance checks]

## Project Structure

[Document the selected directory structure]

> **Modularity Rule**: Each directory should represent a single concern.
> Suggested structure:
> ```
> src/
> ├── models/      # Data models and types
> ├── services/    # Business logic (one service per concern)
> ├── routes/      # API routes / entry points
> ├── lib/         # Shared utilities (minimal, no god modules)
> └── validators/  # Input validation
> tests/
> ├── unit/        # Unit tests (mirror src/ structure)
> └── integration/ # Integration tests
> ```

## Architecture Decisions

[Key technical choices with rationale — ASK the user if any decision is ambiguous]

## YAGNI Audit

| Planned Component | Required By (FR-XXX) | Justified? |
| ----------------- | -------------------- | ---------- |
|                   |                      |            |

> Every planned component MUST trace back to a Functional Requirement.
> If a component cannot be justified, remove it.

## Complexity Tracking

| Violation | Justification | Mitigation |
| --------- | ------------- | ---------- |
|           |               |            |

## Open Questions

> Any remaining ambiguities MUST be resolved before task generation.
> Do NOT proceed to speckit_tasks until all questions are answered.

- [Technical question requiring human input]
