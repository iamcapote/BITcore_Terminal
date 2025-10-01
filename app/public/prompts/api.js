/**
 * Prompt Library API Client
 * Why: Encapsulate network requests for prompts CRUD and GitHub sync endpoints.
 * What: Provides fetch helpers that return parsed JSON or throw rich errors on failure.
 * How: Uses window.fetch with descriptive error messages and minimal branching.
 */
(function registerPromptApi(global) {
  if (!global || global.promptApi) {
    return;
  }

  async function fetchSummaries(query) {
    const params = new URLSearchParams();
    let endpoint = '/api/prompts';

    if (query) {
      endpoint = '/api/prompts/search';
      params.set('query', query);
      params.set('includeBody', 'false');
    }

    const url = params.toString() ? `${endpoint}?${params.toString()}` : endpoint;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load prompts (${response.status})`);
    }

    return response.json();
  }

  async function fetchPrompt(id) {
    const response = await fetch(`/api/prompts/${encodeURIComponent(id)}`);
    if (!response.ok) {
      throw new Error(`Failed to load prompt ${id}`);
    }

    return response.json();
  }

  async function savePrompt(payload) {
    const response = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || 'Failed to save prompt.');
    }

    return body;
  }

  async function deletePrompt(id) {
    const response = await fetch(`/api/prompts/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || 'Failed to delete prompt.');
    }
  }

  async function fetchGitHubStatus() {
    const response = await fetch('/api/prompts/github/status');

    if (response.status === 404 || response.status === 403) {
      return {
        disabled: true,
        status: 'disabled',
        message: 'GitHub sync disabled.'
      };
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `Failed to load GitHub status (${response.status})`);
    }

    return {
      disabled: false,
      status: body.status,
      message: body.message
    };
  }

  async function runGitHubAction(action) {
    const response = await fetch(`/api/prompts/github/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(body.error || `GitHub ${action} failed.`);
    }

    return body;
  }

  global.promptApi = {
    fetchSummaries,
    fetchPrompt,
    savePrompt,
    deletePrompt,
    fetchGitHubStatus,
    runGitHubAction
  };
})(typeof window !== 'undefined' ? window : undefined);
