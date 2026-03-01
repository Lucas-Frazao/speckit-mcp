import { simpleGit, SimpleGit } from 'simple-git';
import * as fs from 'fs';
import * as path from 'path';
import { getProjectRoot, getSpecsDir } from './filesystem.js';

function getGit(): SimpleGit {
  return simpleGit(getProjectRoot());
}

export async function isGitRepo(): Promise<boolean> {
  try {
    const git = getGit();
    await git.status();
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentBranch(): Promise<string | null> {
  try {
    const git = getGit();
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    return branch.trim();
  } catch {
    return null;
  }
}

export async function getNextFeatureNumber(): Promise<number> {
  const specsDir = getSpecsDir();
  let maxNumber = 0;

  // Check existing spec directories
  if (fs.existsSync(specsDir)) {
    const dirs = fs.readdirSync(specsDir);
    for (const dir of dirs) {
      const match = dir.match(/^(\d+)-/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }
  }

  // Also check git branches
  try {
    const git = getGit();
    const branches = await git.branch(['-a']);
    for (const branch of Object.keys(branches.branches)) {
      const match = branch.match(/(\d+)-/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    }
  } catch {
    // Not a git repo or no branches, ignore
  }

  return maxNumber + 1;
}

export async function createFeatureBranch(branchName: string): Promise<{ success: boolean; message: string }> {
  const isRepo = await isGitRepo();
  if (!isRepo) {
    return { success: false, message: 'Not a git repository — branch creation skipped.' };
  }

  try {
    const git = getGit();
    await git.checkoutLocalBranch(branchName);
    return { success: true, message: `Created and checked out branch: ${branchName}` };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Branch may already exist, try to check it out
    try {
      const git = getGit();
      await git.checkout(branchName);
      return { success: true, message: `Checked out existing branch: ${branchName}` };
    } catch {
      return { success: false, message: `Failed to create branch: ${message}` };
    }
  }
}

export async function commitFiles(
  message: string,
  files: string[]
): Promise<{ success: boolean; message: string }> {
  const isRepo = await isGitRepo();
  if (!isRepo) {
    return { success: false, message: 'Not a git repository — commit skipped.' };
  }

  try {
    const git = getGit();
    // Convert absolute paths to relative paths from project root
    const projectRoot = getProjectRoot();
    const relativePaths = files.map((f) => {
      if (path.isAbsolute(f)) {
        return path.relative(projectRoot, f);
      }
      return f;
    });

    await git.add(relativePaths);
    const result = await git.commit(message);
    return {
      success: true,
      message: `Committed: ${result.commit} — ${message}`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Commit failed: ${msg}` };
  }
}

export async function getFeatureNumberFromBranchName(branchName: string): Promise<string | null> {
  const match = branchName.match(/^(\d+)-/);
  return match ? match[1] : null;
}
