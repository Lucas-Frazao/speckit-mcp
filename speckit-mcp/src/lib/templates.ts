export const SPEC_TEMPLATE = `# Feature Specification: [FEATURE NAME]

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

### Key Entities (include if feature involves data)

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria (mandatory)

### Measurable Outcomes

- **SC-001**: [Measurable metric]
- **SC-002**: [Measurable metric]
`;

export const PLAN_TEMPLATE = `# Implementation Plan: [FEATURE]

Branch: [###-feature-name] | Date: [DATE] | Spec: [link]

## Summary

[Extract from feature spec: primary requirement + technical approach]

## Technical Context

- **Language/Version**: [e.g., Python 3.11, TypeScript 5.x]
- **Primary Dependencies**: [e.g., FastAPI, React, Express]
- **Storage**: [e.g., PostgreSQL, SQLite, files]
- **Testing**: [e.g., pytest, vitest, jest]
- **Target Platform**: [e.g., Linux server, Web, iOS]
- **Project Type**: [e.g., web-app, cli, library, api]
- **Performance Goals**: [domain-specific goals]
- **Constraints**: [domain-specific constraints]

## Constitution Check

GATE: Must pass before implementation.
[List constitution principle compliance checks]

## Project Structure

[Document the selected directory structure]

## Complexity Tracking

| Violation | Justification | Mitigation |
| --------- | ------------- | ---------- |
|           |               |            |
`;

export const TASKS_TEMPLATE = `# Tasks: [FEATURE NAME]

Input: Design documents from specs/[###-feature-name]/
Prerequisites: plan.md (required), spec.md (required)

## Format: [ID] [P?] [Story] Description

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)
**Purpose**: Project initialization and basic structure

- [ ] **T001**: Create project structure per implementation plan
- [ ] **T002**: Initialize project with framework dependencies

---

## Phase 2: Foundational (Blocking Prerequisites)
**Purpose**: Core infrastructure that MUST complete before user stories
⚠️ No user story work until this phase is complete

- [ ] **T003**: Setup database schema/migrations
- [ ] **T004**: [P] Implement auth framework
- [ ] **T005**: [P] Setup API routing and middleware

**Checkpoint**: Foundation ready

---

## Phase 3: User Story 1 - [Title] (Priority: P1)
**Goal**: [Brief description]
**Independent Test**: [How to verify]

### Implementation
- [ ] **T006**: [P] [US1] Create models in src/models/
- [ ] **T007**: [US1] Implement service in src/services/
- [ ] **T008**: [US1] Implement endpoint/feature
- [ ] **T009**: [US1] Add validation and error handling

**Checkpoint**: User Story 1 functional

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3+
- User stories can proceed in parallel after Phase 2
`;

export const CONSTITUTION_TEMPLATE = `# [PROJECT_NAME] Constitution

## Core Principles

### [PRINCIPLE_1_NAME]
[PRINCIPLE_1_DESCRIPTION]

### [PRINCIPLE_2_NAME]
[PRINCIPLE_2_DESCRIPTION]

### [PRINCIPLE_3_NAME]
[PRINCIPLE_3_DESCRIPTION]

## Governance
[GOVERNANCE_RULES]

**Version**: 1.0 | **Ratified**: [DATE]
`;

export function getTemplate(name: 'spec' | 'plan' | 'tasks' | 'constitution'): string {
  switch (name) {
    case 'spec':
      return SPEC_TEMPLATE;
    case 'plan':
      return PLAN_TEMPLATE;
    case 'tasks':
      return TASKS_TEMPLATE;
    case 'constitution':
      return CONSTITUTION_TEMPLATE;
  }
}
