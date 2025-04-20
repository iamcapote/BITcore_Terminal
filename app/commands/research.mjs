import { ResearchEngine } from '../infrastructure/research/research.engine.mjs';
import { userManager } from '../features/auth/user-manager.mjs'; // Import userManager
import { callVeniceWithTokenClassifier } from '../utils/token-classifier.mjs';
import { cleanQuery } from '../utils/research.clean-query.mjs';

/**
 * Research command handler.
 * @param {object} options - Command options including positionalArgs, flags, session, password, output, error.
 * @returns {Promise<object>} Research result or error object.
 */
export async function research(options) {
  const { positionalArgs, depth, breadth, classify, session, password, output, error, isWebSocket, webSocketClient } = options;
  const query = positionalArgs.join(' ');

  if (!query) {
    error('Research query required. Usage: /research <query> [--depth=N] [--breadth=N] [--classify]');
    return { success: false, error: 'Missing query', keepDisabled: false };
  }

  if (!session || !session.username) {
      error('Internal Error: User session information is missing.');
      return { success: false, error: 'Missing session info', keepDisabled: false };
  }

  if (!password) {
      error('Internal Error: Password was not provided or retrieved for API key decryption.');
      // This case should ideally be caught by the password prompt logic in routes.mjs,
      // but added here as a safeguard.
      return { success: false, error: 'Missing password for API keys', keepDisabled: false };
  }

  output('Starting research pipeline...');
  if (isWebSocket) {
    // Send a start message to keep input disabled
    webSocketClient.send(JSON.stringify({ type: 'research_start', keepDisabled: true }));
  }

  try {
    // --- Fetch API Keys ---
    output('Retrieving API keys...');
    let braveApiKey, veniceApiKey;
    try {
        braveApiKey = await userManager.getApiKey('brave', password, session.username);
        veniceApiKey = await userManager.getApiKey('venice', password, session.username);

        if (!braveApiKey) {
            throw new Error("Brave API key is not configured for this user.");
        }
        if (!veniceApiKey) {
            throw new Error("Venice API key is not configured for this user.");
        }
        output('API keys retrieved successfully.');
    } catch (keyError) {
        error(`Failed to retrieve API keys: ${keyError.message}`);
        // Ensure input is re-enabled on error if using WebSocket
        if (isWebSocket) {
            webSocketClient.send(JSON.stringify({ type: 'research_complete', error: keyError.message, keepDisabled: false }));
        }
        return { success: false, error: keyError.message, keepDisabled: false };
    }
    // --- API Keys Fetched ---

    let enhancedQuery = { original: cleanQuery(query) };

    // Optional: Token Classification
    if (classify) {
      try {
        output("Classifying query with token classifier...");
        // Ensure the Venice key is available for the classifier call
        const tokenMetadata = await callVeniceWithTokenClassifier(enhancedQuery.original, veniceApiKey);
        enhancedQuery.metadata = tokenMetadata;
        output(`Token classification result: ${JSON.stringify(tokenMetadata)}`);
        output("Using token classification to enhance research quality...");
      } catch (tokenError) {
        error(`Error during token classification: ${tokenError.message}`);
        output("Continuing with basic query...");
      }
    }

    // --- Instantiate ResearchEngine with Keys ---
    const engine = new ResearchEngine({
        // Pass fetched keys
        braveApiKey: braveApiKey,
        veniceApiKey: veniceApiKey,
        // Pass user info
        user: { username: session.username, role: session.role },
        // Pass handlers
        outputHandler: output,
        errorHandler: error,
        // Pass progress handler if using WebSocket
        progressHandler: isWebSocket ? (progressData) => {
            webSocketClient.send(JSON.stringify({ type: 'progress', data: progressData }));
        } : null,
        // Pass debug handler (optional, defaults to console)
        // debugHandler: options.debugHandler || console.debug
    });

    output('Research engine initialized. Starting research...');

    // --- Execute Research ---
    // Pass query object, depth, and breadth to the research method
    const result = await engine.research({
        query: enhancedQuery,
        depth: depth,
        breadth: breadth
    });

    // --- Process Results ---
    output('Research complete.');
    if (result.error) {
        error(`Research failed: ${result.error}`);
        // Send completion message with error for WebSocket
        if (isWebSocket) {
            webSocketClient.send(JSON.stringify({ type: 'research_complete', error: result.error, keepDisabled: false }));
        }
        return { success: false, error: result.error, keepDisabled: false };
    }

    // Output summary and details
    if (result.summary) {
        output("\n--- Research Summary ---");
        output(result.summary);
        output("----------------------");
    }
    if (result.learnings && result.learnings.length > 0) {
        output("\nKey Learnings:");
        result.learnings.forEach((learning, i) => output(`${i + 1}. ${learning}`));
    } else {
        output("\nNo specific learnings generated.");
    }
    if (result.sources && result.sources.length > 0) {
        output("\nSources:");
        result.sources.forEach(source => output(`- ${source}`));
    }
    if (result.filename) {
        output(`\nResults saved to: ${result.filename}`);
    }

    // Send completion message for WebSocket
    if (isWebSocket) {
        webSocketClient.send(JSON.stringify({
            type: 'research_complete',
            summary: result.summary,
            filename: result.filename,
            keepDisabled: false // Re-enable input
        }));
    }

    // Return success state for command handler logic
    return { success: true, ...result, keepDisabled: false };

  } catch (execError) {
    error(`Critical error during research execution: ${execError.message}`);
    console.error(execError.stack); // Log stack trace for server debugging
    // Send completion message with error for WebSocket
    if (isWebSocket) {
        webSocketClient.send(JSON.stringify({ type: 'research_complete', error: execError.message, keepDisabled: false }));
    }
    return { success: false, error: execError.message, keepDisabled: false };
  }
}
