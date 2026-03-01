import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import { getTemplate } from '../lib/templates.js';

export function registerTemplateResources(server: McpServer): void {
  // Spec template
  server.registerResource(
    'template-spec',
    'template://spec',
    {
      description: 'The built-in Spec Kit feature specification template',
      mimeType: 'text/markdown',
    },
    async (_uri): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: 'template://spec',
            mimeType: 'text/markdown',
            text: getTemplate('spec'),
          },
        ],
      };
    }
  );

  // Plan template
  server.registerResource(
    'template-plan',
    'template://plan',
    {
      description: 'The built-in Spec Kit implementation plan template',
      mimeType: 'text/markdown',
    },
    async (_uri): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: 'template://plan',
            mimeType: 'text/markdown',
            text: getTemplate('plan'),
          },
        ],
      };
    }
  );

  // Tasks template
  server.registerResource(
    'template-tasks',
    'template://tasks',
    {
      description: 'The built-in Spec Kit task breakdown template',
      mimeType: 'text/markdown',
    },
    async (_uri): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: 'template://tasks',
            mimeType: 'text/markdown',
            text: getTemplate('tasks'),
          },
        ],
      };
    }
  );

  // Constitution template
  server.registerResource(
    'template-constitution',
    'template://constitution',
    {
      description: 'The built-in Spec Kit project constitution template',
      mimeType: 'text/markdown',
    },
    async (_uri): Promise<ReadResourceResult> => {
      return {
        contents: [
          {
            uri: 'template://constitution',
            mimeType: 'text/markdown',
            text: getTemplate('constitution'),
          },
        ],
      };
    }
  );
}
