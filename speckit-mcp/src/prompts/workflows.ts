import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerWorkflowPrompts(server: McpServer): void {
  // 1. specify — create a feature spec
  server.registerPrompt(
    'specify',
    {
      description:
        'Start the Spec-Driven Development workflow. Acts as a senior software architect and creates a comprehensive feature specification.',
      argsSchema: {
        description: z.string().describe('Plain-language description of the feature to build'),
      },
    },
    ({ description }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `You are acting as a senior software architect following the Spec-Driven Development (Spec Kit) methodology.

Your task: Create a comprehensive feature specification for the following feature request:

"${description}"

Steps to follow:
1. Call \`speckit_specify\` with the description to initialize the spec and get the template
2. Fill in the entire spec template — DO NOT leave any brackets or placeholders unfilled
3. Write at least 2 well-defined user stories with concrete Given/When/Then acceptance scenarios
4. Define measurable success criteria (SC-001, SC-002 format)
5. Identify any functional requirements (FR-001, FR-002 format)
6. After writing the spec, call \`speckit_clarify\` to check for remaining ambiguities
7. Report back with the feature name and next recommended action

Remember: A good spec defines WHAT and WHY, not HOW. Leave implementation decisions for the plan phase.`,
          },
        },
      ],
    })
  );

  // 2. plan — create a technical implementation plan
  server.registerPrompt(
    'plan',
    {
      description:
        'Create a technical implementation plan for a specified feature. Reads the spec and generates a comprehensive plan.',
      argsSchema: {
        featureName: z.string().describe('Feature directory name (e.g. "001-user-auth")'),
      },
    },
    ({ featureName }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `You are acting as a senior software architect following the Spec-Driven Development (Spec Kit) methodology.

Your task: Create a detailed technical implementation plan for feature: **${featureName}**

Steps to follow:
1. Read the spec using the resource \`spec://features/${featureName}/spec\` or call \`speckit_status\` to confirm it exists
2. Ask the user (or infer from context) the following technical context:
   - Language/Version (e.g., TypeScript 5.x, Python 3.11)
   - Primary framework (e.g., Express, FastAPI, React)
   - Storage solution (e.g., PostgreSQL, SQLite, Redis)
   - Testing framework (e.g., jest, vitest, pytest)
   - Target platform
   - Project type (web-app, cli, library, api)
3. Call \`speckit_plan\` with the feature name and tech context
4. Review the generated plan template and fill in:
   - Summary (extract from spec)
   - Constitution Check (verify alignment with principles)
   - Project Structure (define the exact directory layout)
   - Architecture Decisions (key technical choices with rationale)
   - Complexity tracking
5. After filling the plan, recommend running \`speckit_tasks\`

Remember: The plan defines HOW to build the feature. It must be grounded in the spec's user stories.`,
          },
        },
      ],
    })
  );

  // 3. tasks — break down the plan into tasks
  server.registerPrompt(
    'tasks',
    {
      description:
        'Generate a structured, phased task breakdown from a feature plan. Produces tasks.md with IDs, parallel markers, user story labels, and checkpoints.',
      argsSchema: {
        featureName: z.string().describe('Feature directory name (e.g. "001-user-auth")'),
      },
    },
    ({ featureName }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `You are acting as a senior software architect following the Spec-Driven Development (Spec Kit) methodology.

Your task: Generate a detailed task breakdown for feature: **${featureName}**

Steps to follow:
1. Confirm spec.md and plan.md exist by calling \`speckit_status\` with featureName
2. Call \`speckit_tasks\` to generate the initial task breakdown
3. Review the generated tasks:
   - Verify file paths are realistic for this project structure
   - Check that Phase 2 (Foundation) properly blocks user story phases
   - Validate parallel markers [P] — ensure no circular dependencies
   - Add any missing tasks based on the plan's architecture decisions
   - Ensure checkpoints are meaningful and testable
4. If the tasks need refinement, describe the changes needed and call \`speckit_validate\` with artifact "tasks"
5. Report the final task count, phase breakdown, and estimated complexity

Output format tip: Each task should have a specific, actionable description with an exact file path.`,
          },
        },
      ],
    })
  );

  // 4. implement — generate implementation brief for Copilot
  server.registerPrompt(
    'implement',
    {
      description:
        'Generate an implementation brief for the current or specified task. Updates copilot-instructions.md and provides Copilot with all context needed to execute the task.',
      argsSchema: {
        featureName: z.string().describe('Feature directory name (e.g. "001-user-auth")'),
        taskId: z.string().optional().describe('Specific task ID (e.g. "T003"). Defaults to next incomplete task.'),
      },
    },
    ({ featureName, taskId }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `You are acting as a senior software architect following the Spec-Driven Development (Spec Kit) methodology.

Your task: Generate an implementation brief for feature **${featureName}**${taskId ? `, task **${taskId}**` : ' (next incomplete task)'}.

Steps to follow:
1. Call \`speckit_implement\` with featureName: "${featureName}"${taskId ? ` and taskId: "${taskId}"` : ''}
2. The tool will:
   - Find the next incomplete task (or the specified task)
   - Read all relevant context: spec, plan, constitution, data model
   - Update \`.github/copilot-instructions.md\` with full task context
   - Return a detailed implementation brief
3. Present the implementation brief clearly, highlighting:
   - **What** Copilot needs to build
   - **Where** (exact file paths)
   - **Acceptance criteria** that must pass
   - **Constraints** from the constitution
4. Remind the user that GitHub Copilot will read \`.github/copilot-instructions.md\` automatically
5. After Copilot implements the task, tell the user to run \`speckit_complete_task\`

This is the bridge between architect (you) and developer (Copilot).`,
          },
        },
      ],
    })
  );

  // 5. review — review current state and suggest next steps
  server.registerPrompt(
    'review',
    {
      description:
        'Review the current state of a feature and suggest next steps. Validates all artifacts and provides a holistic progress report.',
      argsSchema: {
        featureName: z.string().describe('Feature directory name (e.g. "001-user-auth")'),
      },
    },
    ({ featureName }) => ({
      messages: [
        {
          role: 'user' as const,
          content: {
            type: 'text' as const,
            text: `You are acting as a senior software architect following the Spec-Driven Development (Spec Kit) methodology.

Your task: Review the current state of feature **${featureName}** and provide actionable next steps.

Steps to follow:
1. Call \`speckit_status\` with featureName: "${featureName}" to get current progress
2. Call \`speckit_validate\` with artifact: "all" to check all artifacts for quality issues
3. Read the spec: resource \`spec://features/${featureName}/spec\`
4. Read the tasks: resource \`spec://features/${featureName}/tasks\`
5. Synthesize a review covering:
   - **Overall health**: Is the spec complete? Is the plan detailed enough?
   - **Progress**: How many tasks are done? What phase are we in?
   - **Quality issues**: Any validation failures that need fixing?
   - **Blockers**: Any dependencies or checkpoints that need attention?
   - **Risks**: Are there any areas of the spec that seem underspecified?
6. Provide a prioritized list of next steps
7. If the feature is complete, summarize what was built and suggest creating the next feature

Be honest and direct — flag problems early before they affect implementation.`,
          },
        },
      ],
    })
  );
}
