import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readSpecFile, writeSpecFile } from '../lib/filesystem.js';
import { commitFiles } from '../lib/git.js';
import { parseTaskStatus, calculateProgress, extractFeatureNumber } from '../lib/utils.js';

export function registerCompleteTaskTool(server: McpServer): void {
  server.registerTool(
    'speckit_complete_task',
    {
      description:
        'Mark a task as complete in tasks.md, create a git commit, and return the next task. If the task is a checkpoint, returns a validation reminder.',
      inputSchema: {
        featureName: z.string().describe('The feature directory name (e.g. "001-user-auth")'),
        taskId: z.string().describe('Task ID to mark complete (e.g. "T001")'),
        notes: z
          .string()
          .optional()
          .describe('Optional implementation notes to append to the task'),
      },
    },
    async ({ featureName, taskId, notes }) => {
      const tasksContent = await readSpecFile(featureName, 'tasks.md');
      if (!tasksContent) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: No tasks.md found for feature "${featureName}".`,
            },
          ],
        };
      }

      // Find the task line and mark it complete
      const lines = tasksContent.split('\n');
      let taskFound = false;
      let taskDescription = '';
      let taskIsCheckpoint = false;
      const updatedLines: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const taskMatch = line.match(/^- \[ \] \*\*(\w+)\*\*:?\s*(.+)/);

        if (taskMatch && taskMatch[1] === taskId) {
          taskFound = true;
          taskDescription = taskMatch[2].trim();
          // Mark as complete
          updatedLines.push(line.replace('- [ ]', '- [x]'));

          // Add notes if provided
          if (notes) {
            updatedLines.push(`  > ✅ ${notes}`);
          }

          // Check if next non-empty line is a checkpoint
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].trim() === '') continue;
            if (lines[j].match(/\*\*Checkpoint\*\*/i)) {
              taskIsCheckpoint = true;
            }
            break;
          }
          continue;
        }

        updatedLines.push(line);
      }

      if (!taskFound) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Task ${taskId} not found in tasks.md for feature "${featureName}". Check the task ID.`,
            },
          ],
        };
      }

      const updatedTasksContent = updatedLines.join('\n');
      const tasksFilePath = await writeSpecFile(featureName, 'tasks.md', updatedTasksContent);

      // Calculate progress
      const tasks = parseTaskStatus(updatedTasksContent);
      const progress = calculateProgress(tasks);

      // Commit the change
      const featureNumber = extractFeatureNumber(featureName);
      const commitMessage = `feat(${featureNumber}): ${taskId} - ${taskDescription.replace(/\[P\]|\[US\d+\]/g, '').trim().substring(0, 60)}`;
      const commitResult = await commitFiles(commitMessage, [tasksFilePath]);

      // Find next task
      const nextTask = tasks.find((t) => !t.completed);

      const output: string[] = [
        `✅ **${taskId}** marked complete for feature **${featureName}**`,
        '',
        `**Progress**: ${progress.completed}/${progress.total} tasks (${progress.percentage}%)`,
        '',
        `**Git**: ${commitResult.message}`,
      ];

      if (taskIsCheckpoint) {
        output.push('');
        output.push(`## 🚩 Checkpoint Reached`);
        output.push('Before continuing, validate this phase is working:');
        output.push('- Run your tests');
        output.push('- Verify the feature works end-to-end for completed user stories');
        output.push('- Run `speckit_validate` to check spec compliance');
      }

      if (nextTask) {
        output.push('');
        output.push(`## Next Task`);
        output.push(`**${nextTask.id}**: ${nextTask.description}`);
        if (nextTask.filePath) output.push(`File: \`${nextTask.filePath}\``);
        if (nextTask.userStory) output.push(`Story: ${nextTask.userStory}`);
        output.push('');
        output.push(`Run \`speckit_implement\` to generate the full brief for **${nextTask.id}**.`);
      } else {
        output.push('');
        output.push(`## 🎉 All Tasks Complete!`);
        output.push(`Feature **${featureName}** is fully implemented.`);
        output.push('Run `speckit_validate` with artifact "all" for a final quality check.');
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: output.join('\n'),
          },
        ],
      };
    }
  );
}
