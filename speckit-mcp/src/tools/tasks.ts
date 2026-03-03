import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readSpecFile, writeSpecFile } from '../lib/filesystem.js';
import { getTemplate } from '../lib/templates.js';
import { getDate } from '../lib/utils.js';

export function registerTasksTool(server: McpServer): void {
  server.registerTool(
    'speckit_tasks',
    {
      description:
        'Generate a structured task breakdown from a feature plan. Reads spec.md, plan.md, and data-model.md to produce tasks.md with phased tasks, parallel markers, user story labels, and checkpoints. IMPORTANT: Test tasks are always generated BEFORE their corresponding implementation tasks (TDD-first enforcement).',
      inputSchema: {
        featureName: z.string().describe('The feature directory name (e.g. "001-user-auth")'),
      },
    },
    async ({ featureName }) => {
      const specContent = await readSpecFile(featureName, 'spec.md');
      const planContent = await readSpecFile(featureName, 'plan.md');

      if (!planContent) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: No plan.md found for feature "${featureName}". Run speckit_plan first.`,
            },
          ],
        };
      }
      if (!specContent) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: No spec.md found for feature "${featureName}". Run speckit_specify first.`,
            },
          ],
        };
      }

      // Extract user stories from spec
      const userStories = extractUserStories(specContent);

      // Extract tech context from plan
      const techContext = extractTechContextFromPlan(planContent);

      // Build tasks content
      const tasksContent = buildTasksContent(featureName, userStories, techContext, specContent);

      const tasksFilePath = await writeSpecFile(featureName, 'tasks.md', tasksContent);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Task breakdown created for **${featureName}**

**File:** ${tasksFilePath}

**TDD-First Enforcement:** Test tasks are generated BEFORE implementation tasks in every phase.

---

${tasksContent}

---

**Instructions for Claude (architect):**
1. Review each task — are the file paths realistic for this project?
2. Verify TDD ordering — every implementation task MUST have a preceding test task
3. Verify phase ordering — Phase 2 should block all user story phases
4. Check parallel markers [P] — ensure no circular dependencies
5. Add or refine tasks based on architecture decisions in plan.md
6. Check YAGNI — remove any tasks that build speculative/unused infrastructure
7. Once satisfied, run \`speckit_implement\` to get the first task for Copilot`,
          },
        ],
      };
    }
  );
}

interface UserStory {
  number: number;
  title: string;
  priority: string;
  description: string;
  independentTest: string;
  scenarios: string[];
}

function extractUserStories(specContent: string): UserStory[] {
  const stories: UserStory[] = [];
  const storyPattern = /### User Story (\d+) - ([^\n(]+)\(Priority: (P\d+)\)([\s\S]*?)(?=### User Story |\n## [^#]|$)/g;

  let match;
  while ((match = storyPattern.exec(specContent)) !== null) {
    const number = parseInt(match[1], 10);
    const title = match[2].trim();
    const priority = match[3].trim();
    const body = match[4];

    // Extract independent test
    const testMatch = body.match(/\*\*Independent Test\*\*:\s*([^\n]+)/);
    const independentTest = testMatch ? testMatch[1].trim() : 'Manual verification';

    // Extract first paragraph as description
    const descLines = body
      .split('\n')
      .slice(1)
      .filter((l) => l.trim() && !l.startsWith('**') && !l.startsWith('#'));
    const description = descLines[0]?.trim() ?? '';

    // Extract scenarios
    const scenarioMatches = body.match(/\d+\.\s+\*\*Given\*\*[^\n]*/g) ?? [];
    const scenarios = scenarioMatches.map((s) => s.trim());

    stories.push({ number, title, priority, description, independentTest, scenarios });
  }

  return stories;
}

function extractTechContextFromPlan(planContent: string): Record<string, string> {
  const context: Record<string, string> = {};
  const lines = planContent.split('\n');
  let inTechContext = false;

  for (const line of lines) {
    if (line.includes('## Technical Context')) {
      inTechContext = true;
      continue;
    }
    if (inTechContext && line.startsWith('## ')) {
      break;
    }
    if (inTechContext) {
      const match = line.match(/\*\*([^*]+)\*\*:\s*(.+)/);
      if (match) {
        context[match[1].toLowerCase().replace(/[^a-z]/g, '_')] = match[2].trim();
      }
    }
  }

  return context;
}

function buildTasksContent(
  featureName: string,
  userStories: UserStory[],
  techContext: Record<string, string>,
  specContent: string
): string {
  const date = getDate();

  // Determine file extensions based on tech context
  const lang = techContext.language_version ?? 'TypeScript';
  const ext = lang.toLowerCase().includes('python')
    ? 'py'
    : lang.toLowerCase().includes('typescript') || lang.toLowerCase().includes('ts')
    ? 'ts'
    : lang.toLowerCase().includes('java') && !lang.toLowerCase().includes('javascript')
    ? 'java'
    : lang.toLowerCase().includes('go')
    ? 'go'
    : 'ts';

  const testExt = ext === 'py' ? 'py' : `test.${ext}`;
  const testDir = ext === 'py' ? 'tests/' : 'tests/';

  const storage = techContext.storage ?? '';
  const hasDb =
    storage.toLowerCase().includes('postgres') ||
    storage.toLowerCase().includes('sqlite') ||
    storage.toLowerCase().includes('mysql') ||
    storage.toLowerCase().includes('mongo');

  const projectType = techContext.project_type ?? 'web-app';
  const isApi = projectType === 'api' || projectType === 'web-app';

  // Check if spec has entities
  const hasEntities = specContent.includes('Key Entities') || specContent.includes('Entity');

  let taskCounter = 1;
  const pad = (n: number) => String(n).padStart(3, '0');

  const sections: string[] = [];

  sections.push(`# Tasks: ${featureName}

Input: Design documents from specs/${featureName}/
Prerequisites: plan.md (required), spec.md (required)

## Format: [ID] [P?] [Story] Description

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (e.g., US1, US2)
- **[TEST]**: Test task — MUST be completed before its corresponding implementation task
- Include exact file paths in descriptions

## TDD Rule

> **Tests FIRST, implementation SECOND.** Every implementation task has a preceding test task.
> The test task defines the expected behavior; the implementation task makes it pass.
> No implementation task may begin until its test task is marked complete.

---`);

  // Phase 1: Setup
  sections.push(`
## Phase 1: Setup (Shared Infrastructure)
**Purpose**: Project initialization, basic structure, and test infrastructure

- [ ] **T${pad(taskCounter++)}**: Create project directory structure per plan.md
- [ ] **T${pad(taskCounter++)}**: Initialize project dependencies and configuration files
- [ ] **T${pad(taskCounter++)}**: Setup test framework and test configuration (${techContext.testing ?? 'vitest/jest/pytest'})`);

  // Phase 2: Foundation
  let phase2Lines: string[] = [
    `\n## Phase 2: Foundational (Blocking Prerequisites)`,
    `**Purpose**: Core infrastructure that MUST complete before user stories`,
    `**TDD Rule**: Write tests for each foundational component BEFORE implementing it`,
    `⚠️ No user story work until this phase is complete`,
    ``,
  ];

  if (hasDb) {
    phase2Lines.push(`- [ ] **T${pad(taskCounter++)}**: [TEST] Write tests for database connection and schema in ${testDir}db.${testExt}`);
    phase2Lines.push(`- [ ] **T${pad(taskCounter++)}**: Setup database schema and migrations in db/migrations/`);
    phase2Lines.push(`- [ ] **T${pad(taskCounter++)}**: [P] Implement database connection and pool setup in src/db/connection.${ext}`);
  }

  if (isApi) {
    phase2Lines.push(`- [ ] **T${pad(taskCounter++)}**: [TEST] Write tests for API routing and error handling in ${testDir}api.${testExt}`);
    phase2Lines.push(`- [ ] **T${pad(taskCounter++)}**: [P] Setup API routing and middleware in src/routes/index.${ext}`);
    phase2Lines.push(`- [ ] **T${pad(taskCounter++)}**: [P] Configure error handling and response utilities in src/lib/errors.${ext}`);
  }

  if (hasEntities) {
    phase2Lines.push(`- [ ] **T${pad(taskCounter++)}**: [TEST] Write tests for type validation in ${testDir}types.${testExt}`);
    phase2Lines.push(`- [ ] **T${pad(taskCounter++)}**: [P] Define ${ext === 'py' ? 'models' : 'types'} and interfaces in src/types/index.${ext}`);
  }

  phase2Lines.push(`\n**Checkpoint**: Foundation ready — all foundation tests passing`);
  sections.push(phase2Lines.join('\n'));

  // Phase per user story — TDD-first ordering
  for (const story of userStories) {
    const usLabel = `US${story.number}`;
    const storySlug = story.title.toLowerCase().replace(/\s+/g, '-');
    const storyLines: string[] = [
      `\n## Phase ${2 + story.number}: User Story ${story.number} - ${story.title} (${story.priority})`,
      `**Goal**: ${story.description || 'Implement ' + story.title}`,
      `**Independent Test**: ${story.independentTest}`,
      `**TDD Rule**: All test tasks in this phase MUST complete before their implementation counterparts`,
      ``,
      `### Tests First`,
    ];

    // Test tasks FIRST
    if (hasEntities) {
      storyLines.push(`- [ ] **T${pad(taskCounter++)}**: [TEST] [P] [${usLabel}] Write tests for data model/repository in ${testDir}${storySlug}-model.${testExt}`);
    }
    storyLines.push(`- [ ] **T${pad(taskCounter++)}**: [TEST] [${usLabel}] Write tests for core service logic in ${testDir}${storySlug}-service.${testExt}`);
    if (isApi) {
      storyLines.push(`- [ ] **T${pad(taskCounter++)}**: [TEST] [${usLabel}] Write tests for API endpoint/handler in ${testDir}${storySlug}-api.${testExt}`);
    }
    storyLines.push(`- [ ] **T${pad(taskCounter++)}**: [TEST] [P] [${usLabel}] Write tests for input validation and edge cases in ${testDir}${storySlug}-validation.${testExt}`);

    storyLines.push('');
    storyLines.push(`### Implementation (only after tests above are complete)`);

    // Implementation tasks SECOND
    if (hasEntities) {
      storyLines.push(`- [ ] **T${pad(taskCounter++)}**: [P] [${usLabel}] Implement data model/repository in src/models/${storySlug}.${ext}`);
    }
    storyLines.push(`- [ ] **T${pad(taskCounter++)}**: [${usLabel}] Implement core service logic in src/services/${storySlug}-service.${ext}`);
    if (isApi) {
      storyLines.push(`- [ ] **T${pad(taskCounter++)}**: [${usLabel}] Implement API endpoint/handler in src/routes/${storySlug}.${ext}`);
    }
    storyLines.push(`- [ ] **T${pad(taskCounter++)}**: [P] [${usLabel}] Add input validation and error handling`);

    storyLines.push(`\n**Checkpoint**: User Story ${story.number} — all tests passing, implementation complete`);
    sections.push(storyLines.join('\n'));
  }

  // If no user stories found, add generic phase 3
  if (userStories.length === 0) {
    sections.push(`
## Phase 3: Core Feature Implementation
**Goal**: Implement the primary feature functionality
**TDD Rule**: All test tasks MUST complete before their implementation counterparts

### Tests First
- [ ] **T${pad(taskCounter++)}**: [TEST] Write tests for core business logic in ${testDir}core.${testExt}
- [ ] **T${pad(taskCounter++)}**: [TEST] [P] Write tests for interface/endpoint in ${testDir}api.${testExt}
- [ ] **T${pad(taskCounter++)}**: [TEST] [P] Write tests for validation and edge cases in ${testDir}validation.${testExt}

### Implementation (only after tests above are complete)
- [ ] **T${pad(taskCounter++)}**: Implement core business logic in src/services/
- [ ] **T${pad(taskCounter++)}**: [P] Implement interface/endpoint in src/routes/ or src/cli/
- [ ] **T${pad(taskCounter++)}**: [P] Add validation and error handling

**Checkpoint**: Feature functional — all tests passing`);
  }

  // Dependencies section
  sections.push(`
---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3+
- User stories can proceed in parallel after Phase 2
- Tasks marked [P] can run concurrently within their phase
- **TDD RULE: [TEST] tasks MUST complete before their corresponding implementation tasks**
- Within each phase, the test subsection blocks the implementation subsection`);

  // YAGNI reminder
  sections.push(`
## YAGNI Check

Before implementing any task, verify:
- [ ] This task is directly required by a spec requirement (FR-XXX or SC-XXX)
- [ ] No speculative abstractions or "future-proofing" is included
- [ ] No unused utility functions, helper classes, or config options are created
- [ ] The implementation is the simplest thing that could possibly work`);

  return sections.join('\n');
}
