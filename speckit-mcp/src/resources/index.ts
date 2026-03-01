import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerSpecFileResources } from './spec-files.js';
import { registerTemplateResources } from './templates.js';

export function registerResources(server: McpServer): void {
  registerSpecFileResources(server);
  registerTemplateResources(server);
}
