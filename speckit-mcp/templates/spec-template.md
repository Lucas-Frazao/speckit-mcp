# Feature Specification: [FEATURE NAME]

Feature Branch: [###-feature-name]
Created: [DATE]
Status: Draft
Input: User description: "$ARGUMENTS"

## User Scenarios & Testing (mandatory)

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

## Edge Cases

- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements (mandatory)

### Functional Requirements

- **FR-001**: System MUST [specific capability]
- **FR-002**: System MUST [specific capability]
- **FR-003**: Users MUST be able to [key interaction]

### Non-Functional Requirements

- **NFR-001**: [Performance/security/scalability requirement]

### Key Entities (include if feature involves data)

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Modularity Requirements (mandatory)

- Each concern MUST be in its own module (e.g., validation, business logic, data access, presentation)
- Modules MUST communicate through explicit interfaces, not shared state
- No single file should handle more than one responsibility

## YAGNI Checklist (mandatory)

- [ ] Every requirement maps to a specific user story
- [ ] No speculative features or "nice to haves" are included
- [ ] No abstract infrastructure is planned beyond what is needed for the listed requirements
- [ ] Success criteria are concrete and testable, not aspirational

## Success Criteria (mandatory)

### Measurable Outcomes

- **SC-001**: [Measurable metric]
- **SC-002**: [Measurable metric]

## Open Questions

> List any ambiguities here. These MUST be resolved via `speckit_clarify` before planning.
> Do NOT guess or assume answers to these questions.

- [Question about ambiguous requirement]
- [Question about edge case behavior]
