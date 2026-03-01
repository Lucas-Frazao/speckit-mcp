# Tasks: [FEATURE NAME]

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
