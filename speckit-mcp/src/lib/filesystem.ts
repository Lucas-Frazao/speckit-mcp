import * as fs from 'fs';
import * as path from 'path';

export function getProjectRoot(): string {
  return process.env.SPECKIT_PROJECT_ROOT || process.cwd();
}

export function getSpecifyDir(): string {
  return path.join(getProjectRoot(), '.specify');
}

export function getSpecsDir(): string {
  const projectRoot = getProjectRoot();
  // Check both .specify/specs and specs
  const primary = path.join(projectRoot, '.specify', 'specs');
  const fallback = path.join(projectRoot, 'specs');
  if (!fs.existsSync(primary) && fs.existsSync(fallback)) {
    return fallback;
  }
  return primary;
}

export function getFeatureDir(featureName: string): string {
  return path.join(getSpecsDir(), featureName);
}

export async function readSpecFile(featureName: string, filename: string): Promise<string | null> {
  const filePath = path.join(getFeatureDir(featureName), filename);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

export async function writeSpecFile(featureName: string, filename: string, content: string): Promise<string> {
  const featureDir = getFeatureDir(featureName);
  ensureDir(featureDir);
  const filePath = path.join(featureDir, filename);
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

export async function listFeatures(): Promise<string[]> {
  const specsDir = getSpecsDir();
  if (!fs.existsSync(specsDir)) {
    return [];
  }
  return fs
    .readdirSync(specsDir)
    .filter((entry) => {
      const fullPath = path.join(specsDir, entry);
      return fs.statSync(fullPath).isDirectory();
    })
    .sort();
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

export async function readFileAbsolute(filePath: string): Promise<string | null> {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

export async function writeFileAbsolute(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, content, 'utf-8');
}

export async function readConstitution(): Promise<string | null> {
  const constitutionPath = path.join(getSpecifyDir(), 'memory', 'constitution.md');
  return readFileAbsolute(constitutionPath);
}

export async function writeConstitution(content: string): Promise<string> {
  const constitutionPath = path.join(getSpecifyDir(), 'memory', 'constitution.md');
  await writeFileAbsolute(constitutionPath, content);
  return constitutionPath;
}

export async function readCopilotInstructions(): Promise<string | null> {
  const filePath = path.join(getProjectRoot(), '.github', 'copilot-instructions.md');
  return readFileAbsolute(filePath);
}

export async function writeCopilotInstructions(content: string): Promise<string> {
  const filePath = path.join(getProjectRoot(), '.github', 'copilot-instructions.md');
  await writeFileAbsolute(filePath, content);
  return filePath;
}

export function getRoadmapPath(): string {
  return path.join(getSpecifyDir(), 'roadmap.md');
}

export async function readRoadmap(): Promise<string | null> {
  return readFileAbsolute(getRoadmapPath());
}

export async function writeRoadmap(content: string): Promise<string> {
  const roadmapPath = getRoadmapPath();
  await writeFileAbsolute(roadmapPath, content);
  return roadmapPath;
}

export function getFeatureArtifacts(featureName: string): string[] {
  const featureDir = getFeatureDir(featureName);
  if (!fs.existsSync(featureDir)) {
    return [];
  }
  return fs.readdirSync(featureDir).filter((f) => {
    return fs.statSync(path.join(featureDir, f)).isFile();
  });
}
