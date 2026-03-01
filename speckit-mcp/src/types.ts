export interface SpecFeature {
  name: string;
  branchName: string;
  status: 'draft' | 'planned' | 'in-progress' | 'complete';
  specExists: boolean;
  planExists: boolean;
  tasksExists: boolean;
  progress: FeatureProgress;
}

export interface FeatureProgress {
  total: number;
  completed: number;
  percentage: number;
}

export interface TaskItem {
  id: string;
  description: string;
  completed: boolean;
  parallel: boolean;
  userStory: string | null;
  phase: string;
  filePath?: string;
  isCheckpoint?: boolean;
}

export interface TechContext {
  language: string;
  framework: string;
  storage?: string;
  testing?: string;
  platform?: string;
  projectType: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export interface FeatureStatus {
  featureName: string;
  artifacts: string[];
  progress: {
    total: number;
    completed: number;
    pct: number;
  };
}

export interface CopilotContext {
  projectName?: string;
  featureName: string;
  taskId?: string;
  taskDescription?: string;
  targetFile?: string;
  techContext?: TechContext;
  acceptanceCriteria?: string[];
  dependencies?: string[];
  userStory?: string;
  architectureDecisions?: string;
  doNotRules?: string[];
}

export interface RoadmapFeature {
  name: string;
  slug: string;
  priority: string;
  description: string;
  userStories: string[];
  dependencies: string[];
  status: 'not-started' | 'specifying' | 'planning' | 'tasking' | 'implementing' | 'analyzing' | 'complete';
}

export interface AnalysisIssue {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  file: string;
  fix: string;
}

export interface AnalysisResult {
  issues: AnalysisIssue[];
  needsRevision: boolean;
  summary: string;
}

export interface ExecutionStep {
  nextAction: string;
  toolToCall?: string;
  toolArgs?: Record<string, unknown>;
  context: string;
  featureComplete: boolean;
}
