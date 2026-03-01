import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readSpecFile, writeSpecFile } from '../lib/filesystem.js';

export function registerClarifyTool(server: McpServer): void {
  server.registerTool(
    'speckit_clarify',
    {
      description:
        'Structured Q&A to resolve ambiguities in a feature spec. In "identify" mode, scans the spec for [NEEDS CLARIFICATION] markers and template placeholders. In "apply" mode, applies provided answers to update the spec.',
      inputSchema: {
        featureName: z.string().describe('The feature directory name (e.g. "001-user-auth")'),
        questions: z
          .array(z.string())
          .optional()
          .describe('Additional clarification questions to add (in "identify" mode)'),
        answers: z
          .array(
            z.object({
              question: z.string().describe('The question being answered'),
              answer: z.string().describe('The answer to incorporate into the spec'),
            })
          )
          .optional()
          .describe('Answers to apply to the spec (in "apply" mode)'),
      },
    },
    async ({ featureName, questions, answers }) => {
      const specContent = await readSpecFile(featureName, 'spec.md');
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

      // APPLY MODE: answers were provided
      if (answers && answers.length > 0) {
        let updatedSpec = specContent;

        // Apply each answer by finding corresponding context and replacing [NEEDS CLARIFICATION] markers
        for (const { question, answer } of answers) {
          // Try to find the exact [NEEDS CLARIFICATION] marker near the question context
          const clarificationPattern = /\[NEEDS CLARIFICATION[^\]]*\]/g;
          const matches = [...updatedSpec.matchAll(clarificationPattern)];

          if (matches.length > 0) {
            // Replace the first unresolved marker with the answer
            updatedSpec = updatedSpec.replace(
              matches[0][0],
              answer
            );
          } else {
            // Append a clarification note at the end of the spec
            updatedSpec += `\n\n## Clarification Note\n**Q**: ${question}\n**A**: ${answer}\n`;
          }
        }

        // Update status from Draft to Clarified if no more markers
        const remainingMarkers = updatedSpec.match(/\[NEEDS CLARIFICATION[^\]]*\]/g);
        if (!remainingMarkers || remainingMarkers.length === 0) {
          updatedSpec = updatedSpec.replace('Status: Draft', 'Status: Clarified');
        }

        await writeSpecFile(featureName, 'spec.md', updatedSpec);

        const stillPending = updatedSpec.match(/\[NEEDS CLARIFICATION[^\]]*\]/g);

        return {
          content: [
            {
              type: 'text' as const,
              text: `Applied ${answers.length} answer(s) to spec for **${featureName}**.

${stillPending && stillPending.length > 0
  ? `⚠️ ${stillPending.length} clarification(s) still pending:\n${stillPending.map((m) => `- ${m}`).join('\n')}`
  : '✅ All clarifications resolved. Spec is ready for planning.'
}

**Next step:** Run \`speckit_plan\` to create the implementation plan.`,
            },
          ],
        };
      }

      // IDENTIFY MODE: scan spec for issues
      const issues: string[] = [];
      const placeholders: string[] = [];

      // Find [NEEDS CLARIFICATION] markers
      const clarificationMatches = specContent.match(/\[NEEDS CLARIFICATION[^\]]*\]/g);
      if (clarificationMatches) {
        issues.push(...clarificationMatches.map((m) => `Explicit clarification needed: ${m}`));
      }

      // Find unfilled template placeholders (text in square brackets that are still generic)
      const templatePlaceholders = specContent.match(/\[[A-Z][^\]]*\]/g);
      if (templatePlaceholders) {
        for (const p of templatePlaceholders) {
          // Skip known valid markdown patterns
          if (!p.match(/^\[(US\d+|P\d?|T\d+|DATE|FEATURE|###)\]/)) {
            placeholders.push(`Unfilled placeholder: ${p}`);
          }
        }
      }

      // Check required sections
      const requiredSections = [
        'User Scenarios',
        'Acceptance Scenarios',
        'Functional Requirements',
        'Success Criteria',
      ];
      for (const section of requiredSections) {
        if (!specContent.includes(section)) {
          issues.push(`Missing required section: ${section}`);
        }
      }

      // Check for at least one Given/When/Then scenario
      if (!specContent.match(/\*\*Given\*\*/)) {
        issues.push('No acceptance scenarios found (no Given/When/Then format)');
      }

      // Check for measurable success criteria
      if (!specContent.match(/SC-\d{3}/)) {
        issues.push('No success criteria defined (SC-001, SC-002 format expected)');
      }

      // Add any user-provided questions
      const allQuestions = [...(questions ?? [])];

      const allIssues = [...issues, ...placeholders];

      // Generate auto clarification questions from issues
      const autoQuestions: string[] = allIssues.map((issue) => {
        if (issue.includes('Unfilled placeholder')) {
          return `What should replace ${issue.replace('Unfilled placeholder: ', '')}?`;
        }
        if (issue.includes('Missing required section')) {
          return `Can you provide the "${issue.replace('Missing required section: ', '')}" section?`;
        }
        return `Please address: ${issue}`;
      });

      const allGeneratedQuestions = [...autoQuestions, ...allQuestions];

      return {
        content: [
          {
            type: 'text' as const,
            text: allIssues.length === 0 && allGeneratedQuestions.length === 0
              ? `✅ Spec for **${featureName}** looks complete — no clarifications needed.\n\nRun \`speckit_plan\` to create the implementation plan.`
              : `## Clarification Report: ${featureName}

**Issues found:** ${allIssues.length}
**Questions to resolve:** ${allGeneratedQuestions.length}

### Issues
${allIssues.length > 0 ? allIssues.map((i) => `- ${i}`).join('\n') : 'None'}

### Questions for the User / Product Owner
${allGeneratedQuestions.length > 0 ? allGeneratedQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') : 'None'}

### How to resolve
Call \`speckit_clarify\` again with the \`answers\` parameter:
\`\`\`json
{
  "featureName": "${featureName}",
  "answers": [
    { "question": "Q1 text", "answer": "Your answer" }
  ]
}
\`\`\``,
          },
        ],
      };
    }
  );
}
