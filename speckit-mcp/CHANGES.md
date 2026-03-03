# SpecKit MCP Update — TDD-First, Modular Architecture, YAGNI, and Forced Clarification

## Overview

This update adds four **mandatory, non-removable principles** that are enforced at every level of the SpecKit MCP pipeline — from project initialization, through constitution generation, task breakdown, quality analysis, implementation briefs, and the Copilot agent instructions.

## What Changed

### New File
- **`src/lib/constitution-enforcer.ts`** — Centralizes the 4 mandatory principles and provides helpers to build constitutions with them and validate they're present.

### Modified Files (13 total)

| File | What Changed |
|------|-------------|
| `templates/constitution-template.md` | Added "Mandatory Principles" section (TDD, Modular, YAGNI, Clarification) that appears before project-specific principles |
| `templates/spec-template.md` | Added "Modularity Requirements", "YAGNI Checklist", and "Open Questions" sections |
| `templates/plan-template.md` | Added mandatory constitution compliance checklist (TDD, Modular, YAGNI, Clarification), YAGNI Audit table, modular project structure guide, and "Open Questions" section |
| `src/tools/init.ts` | Default constitution now includes all 4 mandatory principles; copilot stub includes mandatory rules; imports `constitution-enforcer.ts` |
| `src/tools/constitution.ts` | Auto-injects mandatory principles into every constitution; user-provided principles are added as "project-specific"; mandatory principles cannot be removed |
| `src/tools/tasks.ts` | **TDD-first enforcement**: Test tasks (`[TEST]`) are generated BEFORE implementation tasks in every phase; added test setup task in Phase 1; added YAGNI check section at end |
| `src/tools/analyze.ts` | New checks: TDD ordering validation, YAGNI compliance detection, modularity compliance detection, constitution mandatory principle validation, per-user-story test task verification |
| `src/tools/implement.ts` | **TDD-first enforcement at runtime**: If next task is implementation but test task is incomplete, redirects to the test task; test task briefs give test-specific instructions; mandatory rules (YAGNI, Modularity, Clarification) in every brief |
| `src/lib/copilot.ts` | Added comprehensive "MANDATORY: Clarification Over Assumption" section to every generated `copilot-instructions.md`; expanded DO NOT rules for YAGNI; test task awareness in current task section |
| `blueprint/.github/agents/speckit-builder.agent.md` | Rewritten with: 4 mandatory principles section, TDD-first pipeline (test tasks → implementation tasks), mandatory question-asking rules, "When to Ask Questions" section with specific triggers |
| `blueprint/AGENTS.md` | Added mandatory principles listing, updated rules to include TDD-first, YAGNI, and clarification requirements |
| `blueprint/.github/copilot-instructions.md` | Added all 4 mandatory development rules with detailed descriptions |

## How Each Principle Is Enforced

### 1. TDD-First (Test-Driven Development)

| Enforcement Point | How |
|---|---|
| `constitution-enforcer.ts` | Defined as mandatory principle — always included in constitutions |
| `tasks.ts` | Generates `[TEST]` tasks BEFORE implementation tasks in every phase |
| `analyze.ts` | Flags TDD ordering violations as critical issues; verifies every user story has test tasks |
| `implement.ts` | At runtime, if next task is implementation but test is incomplete, **redirects to the test task** |
| `speckit-builder.agent.md` | Pipeline explicitly separates "Tests First" → "Implementation" in Step 5 |
| `copilot.ts` | Test tasks get special instructions ("write tests first, tests should fail initially") |

### 2. Modular Architecture

| Enforcement Point | How |
|---|---|
| `constitution-enforcer.ts` | Defined as mandatory principle |
| `spec-template.md` | New "Modularity Requirements" section requires concern separation |
| `plan-template.md` | Modular project structure guide with suggested directory layout |
| `analyze.ts` | Detects monolithic patterns in plan.md (god class, single-file, all-in-one) |
| `implement.ts` | Every brief includes "Modularity: Keep functions small, single-purpose, loosely coupled" |
| `speckit-builder.agent.md` | Agent rule: "Every function does one thing. Every module has one concern." |

### 3. YAGNI

| Enforcement Point | How |
|---|---|
| `constitution-enforcer.ts` | Defined as mandatory principle |
| `spec-template.md` | New "YAGNI Checklist" requires every requirement maps to a user story |
| `plan-template.md` | "YAGNI Audit" table requires every component traces to a Functional Requirement |
| `tasks.ts` | Generated tasks.md includes a YAGNI check section at the end |
| `analyze.ts` | Detects common YAGNI violations (abstract factory, generic util, plugin system, etc.) |
| `implement.ts` | Every brief includes "YAGNI: Build ONLY what this task requires. No speculative code." |
| `speckit-builder.agent.md` | Agent rules: "If it's not in the spec, don't build it. Period." |

### 4. Clarification Over Assumption

| Enforcement Point | How |
|---|---|
| `constitution-enforcer.ts` | Defined as mandatory principle |
| `copilot.ts` | Every `copilot-instructions.md` now includes a detailed "MANDATORY: Clarification Over Assumption" section with: when to ask, how to ask, and consequences of assuming |
| `implement.ts` | Every brief includes "Clarification: If ANYTHING is ambiguous, STOP and ask the user. Do NOT assume." |
| `speckit-builder.agent.md` | Comprehensive "When to Ask Questions (Mandatory)" section with 10+ specific triggers; "You MUST NOT" section prohibiting disguised assumptions |
| `AGENTS.md` | Rule: "When ambiguity exists, the agent MUST ask the user — never assume" |
| `copilot-instructions.md` | Default stub includes clarification rules |
| Governance in constitution | "When the developer encounters ANY ambiguity, they MUST stop and ask for human clarification — never assume." |

## How to Apply These Changes

1. Copy each updated file to its corresponding location in your `speckit-mcp` repository
2. The new file `src/lib/constitution-enforcer.ts` goes in `src/lib/`
3. Run `npm run build` (or `tsc`) to compile
4. Existing projects: Run `speckit_constitution` again to regenerate with mandatory principles
5. New projects: `speckit_init` will automatically include mandatory principles
