import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerWorkflowPrompts } from './workflows.js';

export function registerPrompts(server: McpServer): void {
  registerWorkflowPrompts(server);
}
