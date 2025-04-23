import { Octokit } from "@octokit/rest";
import path from 'path';
// --- REMOVE direct userManager import if not needed here ---
// import { userManager } from "../features/auth/user-manager.mjs";
import { Buffer } from 'buffer';

/**
 * Uploads or updates a file in a GitHub repository.
 *
 * @param {object} config - GitHub configuration object.
 * @param {string} config.token - GitHub Personal Access Token (PAT). MUST BE DECRYPTED.
 * @param {string} config.owner - Repository owner (username or organization).
 * @param {string} config.repo - Repository name.
 * @param {string} config.branch - Branch name (e.g., 'main').
 * @param {string} repoPath - The desired path of the file within the repository (e.g., 'research/results/file.md').
 * @param {string} content - The content of the file to upload.
 * @param {string} commitMessage - The commit message.
 * @param {Function} [outputFn=console.log] - Optional output function.
 * @param {Function} [errorFn=console.error] - Optional error function.
 * @returns {Promise<object>} Object containing commit URL and file URL.
 * @throws {Error} If upload fails.
 */
export async function uploadToGitHub(config, repoPath, content, commitMessage, outputFn = console.log, errorFn = console.error) {
    if (!config || !config.token || !config.owner || !config.repo || !config.branch) {
        errorFn("[GitHub Upload] GitHub configuration (token, owner, repo, branch) is incomplete.");
        throw new Error("GitHub configuration (token, owner, repo, branch) is incomplete.");
    }
    if (!repoPath || content === undefined || !commitMessage) {
        errorFn("[GitHub Upload] Missing parameters for GitHub upload (repoPath, content, commitMessage).");
        throw new Error("Missing parameters for GitHub upload (repoPath, content, commitMessage).");
    }

    // --- Log token length for verification, DO NOT log the token itself ---
    outputFn(`[GitHub Upload] Using token (length: ${config.token.length}) for ${config.owner}/${config.repo}`);
    // ---

    const octokit = new Octokit({ auth: config.token });

    const cleanRepoPath = repoPath.startsWith('/') ? repoPath.substring(1) : repoPath; // Ensure no leading slash

    let sha;
    try {
        // Check if the file already exists to get its SHA (needed for update)
        outputFn(`[GitHub Upload] Checking for existing file at path: ${cleanRepoPath} on branch ${config.branch}`);
        const { data: existingFile } = await octokit.rest.repos.getContent({ // Use octokit.rest
            owner: config.owner,
            repo: config.repo,
            path: cleanRepoPath,
            ref: config.branch,
        });
        if (existingFile && existingFile.sha) {
            sha = existingFile.sha;
            outputFn(`[GitHub Upload] Found existing file with SHA: ${sha}`);
        }
    } catch (error) {
        if (error.status === 404) {
            // 404 means the file doesn't exist, which is fine for creation.
            outputFn(`[GitHub Upload] File does not exist at path: ${cleanRepoPath}. Creating new file.`);
        } else {
            errorFn("[GitHub Upload] Error checking existing file:", error.response?.data || error.message);
            const credentialHint = (error.status === 401 || error.message?.includes('Bad credentials'))
                ? ' Check if your GitHub token is valid and has `repo` scope.'
                : '';
            const statusHint = error.status ? ` (Status: ${error.status})` : '';
            throw new Error(`Failed to check existing file on GitHub: ${error.message || 'Unknown error'}${statusHint}.${credentialHint}`);
        }
    }

    try {
        outputFn(`[GitHub Upload] Creating/updating file at path: ${cleanRepoPath}`);
        const { data: commitData } = await octokit.rest.repos.createOrUpdateFileContents({ // Use octokit.rest
            owner: config.owner,
            repo: config.repo,
            path: cleanRepoPath,
            message: commitMessage,
            content: Buffer.from(content).toString('base64'),
            branch: config.branch,
            sha: sha, // Include SHA if updating an existing file
        });
        outputFn(`[GitHub Upload] File uploaded successfully. Commit: ${commitData.commit.sha}`);

        return {
            commitUrl: commitData.commit.html_url,
            fileUrl: commitData.content.html_url,
            sha: commitData.commit.sha, // Return sha as well
        };
    } catch (error) {
        errorFn("[GitHub Upload] GitHub Upload Error Details:", error.response?.data || error.message);
        const credentialHint = (error.status === 401 || error.message?.includes('Bad credentials'))
            ? ' Check if your GitHub token is valid and has `repo` scope.'
            : '';
        const statusHint = error.status ? ` (Status: ${error.status})` : '';
        throw new Error(`Failed to upload file to GitHub: ${error.message || 'Unknown error'}${statusHint}.${credentialHint}`);
    }
}
