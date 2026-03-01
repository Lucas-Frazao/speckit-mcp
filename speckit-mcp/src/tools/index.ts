import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerInitTool } from './init.js';
import { registerConstitutionTool } from './constitution.js';
import { registerSpecifyTool } from './specify.js';
import { registerClarifyTool } from './clarify.js';
import { registerPlanTool } from './plan.js';
import { registerTasksTool } from './tasks.js';
import { registerImplementTool } from './implement.js';
import { registerCompleteTaskTool } from './complete-task.js';
import { registerValidateTool } from './validate.js';
import { registerStatusTool } from './status.js';
import { registerLoadRoadmapTool } from './load-roadmap.js';
import { registerAnalyzeTool } from './analyze.js';
import { registerExecuteFeatureTool } from './execute-feature.js';
import { registerUpdateRoadmapTool } from './update-roadmap.js';
import { registerNextFeatureTool } from './next-feature.js';

export function registerTools(server: McpServer): void {
  registerInitTool(server);
  registerConstitutionTool(server);
  registerSpecifyTool(server);
  registerClarifyTool(server);
  registerPlanTool(server);
  registerTasksTool(server);
  registerImplementTool(server);
  registerCompleteTaskTool(server);
  registerValidateTool(server);
  registerStatusTool(server);
  registerLoadRoadmapTool(server);
  registerAnalyzeTool(server);
  registerExecuteFeatureTool(server);
  registerUpdateRoadmapTool(server);
  registerNextFeatureTool(server);
}
