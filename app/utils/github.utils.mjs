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
    // --- FIX: Pass output/error functions to subsequent calls ---
    const log = (...args) => outputFn('[GitHub Upload]', ...args);
    const errLog = (...args) => errorFn('[GitHub Upload]', ...args);
    // --- END FIX ---

    if (!config || !config.token || !config.owner || !config.repo || !config.branch) {
        errLog("GitHub configuration (token, owner, repo, branch) is incomplete.");
        throw new Error("GitHub configuration (token, owner, repo, branch) is incomplete.");
    }
    if (!repoPath || content === undefined || !commitMessage) {
        errLog("Missing parameters for GitHub upload (repoPath, content, commitMessage).");
        throw new Error("Missing parameters for GitHub upload (repoPath, content, commitMessage).");
    }

    // --- Log token length for verification, DO NOT log the token itself ---
    log(`Using token (length: ${config.token.length}) for ${config.owner}/${config.repo}`);
    // ---

    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${repoPath}`;
    const headers = {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
    };

    try {
        // Check if the file already exists
        const existingFileResponse = await fetch(`${url}?ref=${config.branch}`, { headers });
        let sha = null;

        if (existingFileResponse.ok) {
            const existingFile = await existingFileResponse.json();
            sha = existingFile.sha; // Use the SHA for updating the file
        }

        // Prepare the payload
        const payload = {
            message: commitMessage,
            content: Buffer.from(content).toString('base64'),
            branch: config.branch,
            ...(sha && { sha }), // Include SHA if updating an existing file
        };

        // Upload or update the file
        const response = await fetch(url, {
            method: 'PUT',
            headers,
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorDetails = await response.json();
            throw new Error(`Failed to upload file to GitHub: ${errorDetails.message} (Status: ${response.status})`);
        }

        const result = await response.json();
        outputFn(`File uploaded successfully: ${result.content.html_url}`);
        return result;
    } catch (error) {
        errorFn(`Error performing action 'upload': ${error.message}`);
        throw error;
    }
}
