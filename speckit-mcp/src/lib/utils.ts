import type { TaskItem } from '../types.js';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function padFeatureNumber(num: number): string {
  return String(num).padStart(3, '0');
}

export function buildBranchName(num: number, shortName: string): string {
  return `${padFeatureNumber(num)}-${slugify(shortName)}`;
}

export function parseTaskStatus(tasksContent: string): TaskItem[] {
  const tasks: TaskItem[] = [];
  const lines = tasksContent.split('\n');
  let currentPhase = 'Unknown';

  for (const line of lines) {
    // Detect phase headers
    const phaseMatch = line.match(/^## Phase \d+: (.+)/);
    if (phaseMatch) {
      currentPhase = phaseMatch[1].trim();
      continue;
    }

    // Detect task lines: - [ ] **T001**: description or - [x] **T001**: description
    const taskMatch = line.match(/^- \[([ x])\] \*\*(\w+)\*\*:?\s*(.+)/);
    if (taskMatch) {
      const completed = taskMatch[1] === 'x';
      const id = taskMatch[2];
      const rest = taskMatch[3].trim();

      // Check for [P] parallel marker
      const parallel = rest.includes('[P]');

      // Check for [USN] user story marker
      const usMatch = rest.match(/\[US(\d+)\]/);
      const userStory = usMatch ? `US${usMatch[1]}` : null;

      // Extract file path — heuristic: look for src/ paths or file.ext patterns
      const filePathMatch = rest.match(/(?:in|to|from|at|create|update)?\s+((?:src|lib|test|dist|app|pages|components|services|models|routes|utils|types|hooks|api|db|config|scripts|public)\/[\w./\-]+(?:\.\w+)?)/i);
      const filePath = filePathMatch ? filePathMatch[1] : undefined;

      // Clean description
      const description = rest.replace(/\[P\]/g, '').replace(/\[US\d+\]/g, '').trim();

      tasks.push({
        id,
        description,
        completed,
        parallel,
        userStory,
        phase: currentPhase,
        filePath,
        isCheckpoint: false,
      });
      continue;
    }

    // Detect checkpoint lines
    if (line.match(/\*\*Checkpoint\*\*/i)) {
      const checkpointMatch = line.match(/\*\*Checkpoint\*\*:?\s*(.*)/i);
      if (checkpointMatch && tasks.length > 0) {
        // Mark previous task as having a checkpoint after it
        tasks[tasks.length - 1].isCheckpoint = true;
      }
    }
  }

  return tasks;
}

export function findNextIncompleteTask(tasks: TaskItem[]): TaskItem | null {
  return tasks.find((t) => !t.completed) ?? null;
}

export function calculateProgress(tasks: TaskItem[]): { total: number; completed: number; percentage: number } {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percentage };
}

export function extractFeatureNumber(featureName: string): string {
  const match = featureName.match(/^(\d+)/);
  return match ? match[1] : '000';
}

export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

export function formatList(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n');
}
