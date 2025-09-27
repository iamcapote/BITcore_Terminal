// Infrastructure: GitHub Research Sync Adapters
// Why: Low-level repo operations for research sync (verify, pull, push, upload)
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export async function verifyRepo(repo, { signal } = {}) {
  // Check if repo exists and is accessible
  try {
    await execAsync(`git ls-remote ${repo}`);
    return { success: true, message: 'Repo verified' };
  } catch (e) {
    return { success: false, message: 'Repo verification failed', details: e.message };
  }
}

export async function pullRepo(repo, { signal } = {}) {
  try {
    await execAsync(`git -C ${repo} pull`);
    return { success: true, message: 'Repo pulled' };
  } catch (e) {
    return { success: false, message: 'Pull failed', details: e.message };
  }
}

export async function pushRepo(repo, { signal } = {}) {
  try {
    await execAsync(`git -C ${repo} push`);
    return { success: true, message: 'Repo pushed' };
  } catch (e) {
    return { success: false, message: 'Push failed', details: e.message };
  }
}

export async function uploadFiles(repo, files, { signal } = {}) {
  try {
    for (const file of files) {
      await execAsync(`git -C ${repo} add ${file}`);
    }
    await execAsync(`git -C ${repo} commit -m "Upload via BITcore"`);
    await execAsync(`git -C ${repo} push`);
    return { success: true, message: 'Files uploaded and pushed' };
  } catch (e) {
    return { success: false, message: 'Upload failed', details: e.message };
  }
}
