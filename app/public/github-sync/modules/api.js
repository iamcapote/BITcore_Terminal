export class GitHubSyncError extends Error {
  constructor(message, { status, correlationId, details } = {}) {
    super(message);
    this.name = 'GitHubSyncError';
    this.status = status ?? null;
    this.correlationId = correlationId ?? null;
    this.details = details ?? null;
  }
}

async function parseJson(response) {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  } catch (error) {
    return {};
  }
}

function buildQueryString(params = {}) {
  const url = new URL('http://localhost');
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item));
    } else {
      url.searchParams.set(key, value);
    }
  });
  return url.searchParams.toString();
}

export class GitHubSyncAPI {
  constructor({
    basePath = '/api/research',
    missionsPath = '/api/missions',
    fetchImpl = fetch
  } = {}) {
    this.basePath = basePath;
    this.missionsPath = missionsPath;
    this.fetchImpl = fetchImpl;
  }

  async githubSync(payload = {}) {
    const response = await this.fetchImpl(`${this.basePath}/github-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    const data = await parseJson(response);
    if (!response.ok || !data.ok) {
      throw new GitHubSyncError(data.error || `GitHub sync failed (${response.status})`, {
        status: response.status,
        correlationId: data.correlationId,
        details: data.details
      });
    }
    return data;
  }

  async verify(options = {}) {
    return this.githubSync({ action: 'verify', ...options });
  }

  async listEntries({ path = '', ref, branch, message } = {}) {
    const payload = {
      action: 'list',
      path,
      ref,
      branch,
      message
    };
    const { data } = await this.githubSync(payload);
    return data;
  }

  async fetchFile({ path, ref, branch } = {}) {
    if (!path) {
      throw new GitHubSyncError('fetchFile requires a path.');
    }
    const { data } = await this.githubSync({ action: 'file', path, ref, branch });
    return data;
  }

  async uploadFile({ path, content, branch, message } = {}) {
    if (!path || typeof content !== 'string') {
      throw new GitHubSyncError('uploadFile requires path and content.');
    }
    const payload = {
      action: 'upload',
      path,
      content,
      branch,
      message
    };
    const { data } = await this.githubSync(payload);
    return data;
  }

  async pushFiles({ files, branch, message } = {}) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new GitHubSyncError('pushFiles requires at least one file.');
    }
    const normalizedFiles = files.map(({ path, content }) => ({ path, content }));
    const { data } = await this.githubSync({ action: 'push', files: normalizedFiles, branch, message });
    return data;
  }

  async fetchActivitySnapshot(params = {}) {
    const query = buildQueryString(params);
    const url = `${this.basePath}/github-activity/snapshot${query ? `?${query}` : ''}`;
    const response = await this.fetchImpl(url, { credentials: 'include' });
    const data = await parseJson(response);
    if (!response.ok || data.ok === false) {
      throw new GitHubSyncError(data.error || `Snapshot request failed (${response.status})`, {
        status: response.status,
        correlationId: data.correlationId
      });
    }
    return data;
  }

  async fetchActivityStats(params = {}) {
    const query = buildQueryString(params);
    const url = `${this.basePath}/github-activity/stats${query ? `?${query}` : ''}`;
    const response = await this.fetchImpl(url, { credentials: 'include' });
    const data = await parseJson(response);
    if (!response.ok || data.ok === false) {
      throw new GitHubSyncError(data.error || `Stats request failed (${response.status})`, {
        status: response.status,
        correlationId: data.correlationId
      });
    }
    return data;
  }

  async getMissionState() {
    const response = await this.fetchImpl(`${this.missionsPath}/state`, { credentials: 'include' });
    const data = await parseJson(response);
    if (!response.ok || data.error) {
      throw new GitHubSyncError(data.error || `Failed to load mission state (${response.status})`, {
        status: response.status
      });
    }
    return data;
  }

  async listMissions(params = {}) {
    const query = buildQueryString(params);
    const url = query ? `${this.missionsPath}?${query}` : this.missionsPath;
    const response = await this.fetchImpl(url, {
      credentials: 'include'
    });
    const data = await parseJson(response);
    if (!response.ok || data.error) {
      throw new GitHubSyncError(data.error || `Failed to load missions (${response.status})`, {
        status: response.status
      });
    }
    return data;
  }

  async createMission(draft) {
    const response = await this.fetchImpl(this.missionsPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(draft)
    });
    const data = await parseJson(response);
    if (!response.ok || data.error) {
      throw new GitHubSyncError(data.error || `Failed to create mission (${response.status})`, {
        status: response.status
      });
    }
    return data;
  }

  async updateMission(id, patch) {
    const url = `${this.missionsPath}/${encodeURIComponent(id)}`;
    const response = await this.fetchImpl(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patch)
    });
    const data = await parseJson(response);
    if (!response.ok || data.error) {
      throw new GitHubSyncError(data.error || `Failed to update mission (${response.status})`, {
        status: response.status
      });
    }
    return data;
  }
}
