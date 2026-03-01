import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import {
  listFeatures,
  readSpecFile,
  readConstitution,
  readCopilotInstructions,
} from '../lib/filesystem.js';

export function registerSpecFileResources(server: McpServer): void {
  // List all features (static resource)
  server.registerResource(
    'spec-features',
    'spec://features',
    {
      description: 'Lists all features in the .specify/specs/ directory',
      mimeType: 'text/plain',
    },
    async (_uri): Promise<ReadResourceResult> => {
      const features = await listFeatures();
      return {
        contents: [
          {
            uri: 'spec://features',
            mimeType: 'text/plain',
            text:
              features.length === 0
                ? 'No features found. Run speckit_specify to create one.'
                : `Features:\n${features.map((f) => `- ${f}`).join('\n')}`,
          },
        ],
      };
    }
  );

  // Constitution (static resource)
  server.registerResource(
    'spec-constitution',
    'spec://constitution',
    {
      description: 'The governing principles for the project (.specify/memory/constitution.md)',
      mimeType: 'text/markdown',
    },
    async (_uri): Promise<ReadResourceResult> => {
      const content = await readConstitution();
      return {
        contents: [
          {
            uri: 'spec://constitution',
            mimeType: 'text/markdown',
            text: content ?? 'Constitution not found. Run speckit_constitution to create one.',
          },
        ],
      };
    }
  );

  // Copilot instructions (static resource)
  server.registerResource(
    'spec-copilot-instructions',
    'spec://copilot-instructions',
    {
      description: 'Current .github/copilot-instructions.md — the architect→developer bridge',
      mimeType: 'text/markdown',
    },
    async (_uri): Promise<ReadResourceResult> => {
      const content = await readCopilotInstructions();
      return {
        contents: [
          {
            uri: 'spec://copilot-instructions',
            mimeType: 'text/markdown',
            text:
              content ??
              'copilot-instructions.md not found. Run speckit_implement to generate it.',
          },
        ],
      };
    }
  );

  // Feature spec (dynamic resource template)
  const specTemplate = new ResourceTemplate('spec://features/{featureName}/spec', {
    list: async () => {
      const features = await listFeatures();
      return {
        resources: features.map((f) => ({
          uri: `spec://features/${f}/spec`,
          name: `${f} — spec.md`,
          description: `Feature specification for ${f}`,
          mimeType: 'text/markdown',
        })),
      };
    },
  });

  server.registerResource(
    'spec-feature-spec',
    specTemplate,
    {
      description: 'The spec.md for a specific feature',
      mimeType: 'text/markdown',
    },
    async (uri, variables): Promise<ReadResourceResult> => {
      const featureName = String(variables['featureName'] ?? '');
      const content = await readSpecFile(featureName, 'spec.md');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: content ?? `spec.md not found for feature "${featureName}".`,
          },
        ],
      };
    }
  );

  // Feature plan (dynamic resource template)
  const planTemplate = new ResourceTemplate('spec://features/{featureName}/plan', {
    list: async () => {
      const features = await listFeatures();
      return {
        resources: features.map((f) => ({
          uri: `spec://features/${f}/plan`,
          name: `${f} — plan.md`,
          description: `Implementation plan for ${f}`,
          mimeType: 'text/markdown',
        })),
      };
    },
  });

  server.registerResource(
    'spec-feature-plan',
    planTemplate,
    {
      description: 'The plan.md for a specific feature',
      mimeType: 'text/markdown',
    },
    async (uri, variables): Promise<ReadResourceResult> => {
      const featureName = String(variables['featureName'] ?? '');
      const content = await readSpecFile(featureName, 'plan.md');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text:
              content ??
              `plan.md not found for feature "${featureName}". Run speckit_plan first.`,
          },
        ],
      };
    }
  );

  // Feature tasks (dynamic resource template)
  const tasksTemplate = new ResourceTemplate('spec://features/{featureName}/tasks', {
    list: async () => {
      const features = await listFeatures();
      return {
        resources: features.map((f) => ({
          uri: `spec://features/${f}/tasks`,
          name: `${f} — tasks.md`,
          description: `Task breakdown for ${f}`,
          mimeType: 'text/markdown',
        })),
      };
    },
  });

  server.registerResource(
    'spec-feature-tasks',
    tasksTemplate,
    {
      description: 'The tasks.md for a specific feature',
      mimeType: 'text/markdown',
    },
    async (uri, variables): Promise<ReadResourceResult> => {
      const featureName = String(variables['featureName'] ?? '');
      const content = await readSpecFile(featureName, 'tasks.md');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text:
              content ??
              `tasks.md not found for feature "${featureName}". Run speckit_tasks first.`,
          },
        ],
      };
    }
  );

  // Feature data-model (dynamic resource template)
  const dataModelTemplate = new ResourceTemplate('spec://features/{featureName}/data-model', {
    list: async () => {
      const features = await listFeatures();
      return {
        resources: features.map((f) => ({
          uri: `spec://features/${f}/data-model`,
          name: `${f} — data-model.md`,
          description: `Data model for ${f}`,
          mimeType: 'text/markdown',
        })),
      };
    },
  });

  server.registerResource(
    'spec-feature-data-model',
    dataModelTemplate,
    {
      description: 'The data-model.md for a specific feature',
      mimeType: 'text/markdown',
    },
    async (uri, variables): Promise<ReadResourceResult> => {
      const featureName = String(variables['featureName'] ?? '');
      const content = await readSpecFile(featureName, 'data-model.md');
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: 'text/markdown',
            text: content ?? `data-model.md not found for feature "${featureName}".`,
          },
        ],
      };
    }
  );
}
