/**
 * Research GitHub Dashboard Orchestration
 * Why: Keep the research library's GitHub explorer responsive and in sync with backend operations.
 * What: Handles verification, directory and file loading, inline editing, and commit pushes from the UI.
 * How: Leverages fetch-based APIs, shared renderers, and activity logging utilities to present repository state.
 */
function ensureBasePath(fullPath) {
  const candidate = typeof fullPath === 'string' ? fullPath : '';
  if (!githubState.basePath) {
    const segment = candidate.includes('/') ? candidate.split('/')[0] : candidate;
    githubState.basePath = segment || 'research';
  }
  return githubState.basePath;
}

function stripBasePath(pathLike) {
  if (!pathLike) return '';
  const base = ensureBasePath(pathLike);
  if (pathLike === base) return '';
  const prefix = `${base}/`;
  if (pathLike.startsWith(prefix)) {
    return pathLike.slice(prefix.length);
  }
  return pathLike;
}

function handleGitHubEntry(entry) {
  if (!entry) return;
  if (entry.type === 'dir') {
    loadGitHubDirectory(entry.relativePath);
  } else {
    loadGitHubFile(entry.relativePath);
  }
}

async function verifyGitHubConnection() {
  githubState.verifying = true;
  renderGitHubStatus('Verifying…');
  try {
    const response = await fetch('/api/research/github/verify', { credentials: 'include' });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'GitHub verification failed');
    }
    const data = await response.json();
    githubState.verified = true;
    githubState.repo = data.repository || null;
    githubState.branch = data.branch || null;
    githubState.error = null;
    renderGitHubStatus('Connected', 'connected');
    logGitHubActivity(`Verified ${data.config.owner}/${data.config.repo} on branch ${data.config.branch}`);
  } catch (error) {
    githubState.verified = false;
    githubState.error = error;
    renderGitHubStatus(error.message || 'GitHub unavailable', 'error');
    logGitHubActivity(`Verification failed: ${error.message}`, 'error');
    throw error;
  } finally {
    githubState.verifying = false;
  }
}

async function loadGitHubDirectory(path = '') {
  githubState.loadingDirectory = true;
  githubState.loadingMessage = path ? `Loading ${path}…` : 'Loading directory…';
  renderGitHubEntries();

  const params = new URLSearchParams();
  if (path) params.set('path', path);

  try {
    const response = await fetch(`/api/research/github/files?${params.toString()}`, { credentials: 'include' });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Failed to load directory');
    }

    const data = await response.json();
    ensureBasePath(data.path || path || '');
    githubState.currentPath = stripBasePath(data.path || '');
    githubState.entries = (data.entries || []).map((entry) => ({
      ...entry,
      relativePath: stripBasePath(entry.path || entry.name || ''),
      name: entry.name || entry.path?.split('/').pop() || 'untitled'
    }));
    githubState.error = null;

    renderGitHubEntries();
    renderGitHubPath();
    renderGitHubCategoryView();
    renderGitHubTagsView();
    logGitHubActivity(`Loaded ${githubState.currentPath || '/'} directory`);
  } catch (error) {
    githubState.error = error;
    renderGitHubEntries();
    renderGitHubStatus(error.message || 'GitHub unavailable', 'error');
    logGitHubActivity(`Directory load failed: ${error.message}`, 'error');
  } finally {
    githubState.loadingDirectory = false;
  }
}

async function loadGitHubFile(path) {
  if (!path) return;
  renderGitHubStatus('Loading file…');
  logGitHubActivity(`Fetching ${path}`);

  const params = new URLSearchParams({ path });
  try {
    const response = await fetch(`/api/research/github/file?${params.toString()}`, { credentials: 'include' });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Failed to load file');
    }

    const file = await response.json();
    const relativePath = stripBasePath(file.path || path);
    const name = relativePath.split('/').pop() || relativePath;
    githubState.selected = {
      path: relativePath,
      name,
      sha: file.sha || null,
      size: file.size || null,
      ref: file.ref || null,
      content: file.content || ''
    };
    githubState.error = null;

    renderDocumentViewer(githubState.selected);
    renderGitHubStatus('Connected', 'connected');
    logGitHubActivity(`Loaded ${relativePath}`);
  } catch (error) {
    githubState.error = error;
    renderGitHubStatus(error.message || 'GitHub unavailable', 'error');
    logGitHubActivity(`File load failed: ${error.message}`, 'error');
  }
}

function enterEditMode() {
  if (!githubState.selected || !els.documentContent) {
    logGitHubActivity('Select a document before editing.', 'warn');
    return;
  }
  if (githubState.editorActive) return;

  const textarea = document.createElement('textarea');
  textarea.id = 'document-editor';
  textarea.className = 'document-editor';
  textarea.value = githubState.selected.content || '';
  els.documentContent.innerHTML = '';
  els.documentContent.appendChild(textarea);
  textarea.focus();

  githubState.editorActive = true;
  if (els.documentSave) {
    els.documentSave.disabled = false;
    els.documentSave.textContent = 'Save changes';
  }
  logGitHubActivity(`Editing ${githubState.selected.name}`);
}

function exitEditMode() {
  if (!els.documentContent) return;
  githubState.editorActive = false;
  const fallback = 'Select a document from the file explorer to view its contents.';
  els.documentContent.textContent = githubState.selected?.content || fallback;
  if (els.documentSave) {
    els.documentSave.textContent = 'Save to GitHub';
    els.documentSave.disabled = !githubState.selected;
  }
}

function getEditorContent() {
  if (githubState.editorActive) {
    const textarea = document.getElementById('document-editor');
    return textarea ? textarea.value : githubState.selected?.content || '';
  }
  return githubState.selected?.content || '';
}

async function saveCurrentDocument() {
  if (!githubState.selected) {
    logGitHubActivity('Select a document before saving.', 'warn');
    return;
  }
  if (githubState.pendingSave) {
    return;
  }

  const content = getEditorContent();
  if (!githubState.editorActive && content === githubState.selected.content) {
    logGitHubActivity('No changes detected; nothing to save.');
    return;
  }

  githubState.pendingSave = true;
  renderGitHubStatus('Saving…');
  if (els.documentSave) {
    els.documentSave.disabled = true;
    els.documentSave.textContent = 'Saving…';
  }
  logGitHubActivity(`Saving ${githubState.selected.name}…`);

  const payload = {
    files: [
      {
        path: githubState.selected.path,
        content
      }
    ],
    message: `Update ${githubState.selected.name}`
  };
  if (githubState.branch?.name) {
    payload.branch = githubState.branch.name;
  }

  try {
    const response = await fetch('/api/research/github/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Save failed');
    }
    const result = await response.json();
    githubState.selected.content = content;
    exitEditMode();
    if (els.documentSave) {
      els.documentSave.disabled = false;
      els.documentSave.textContent = 'Save to GitHub';
    }
    renderGitHubStatus('Connected', 'connected');
    logGitHubActivity(`Saved ${githubState.selected.name}`);
    const summary = result?.summaries?.[0];
    if (summary?.commitSha) {
      logGitHubActivity(`Commit ${summary.commitSha.slice(0, 7)} recorded`, 'info');
    }
  } catch (error) {
    renderGitHubStatus(error.message || 'Save failed', 'error');
    logGitHubActivity(`Save failed: ${error.message}`, 'error');
  } finally {
    githubState.pendingSave = false;
    if (els.documentSave) {
      els.documentSave.disabled = false;
      els.documentSave.textContent = 'Save to GitHub';
    }
  }
}

function closeDocumentViewer() {
  githubState.selected = null;
  githubState.editorActive = false;
  if (els.documentViewer) {
    els.documentViewer.classList.add('hidden');
  }
  exitEditMode();
}

function initializeGitHubDashboard() {
  renderGitHubStatus('Checking GitHub…');
  renderGitHubActivity();
  renderGitHubEntries();
  renderGitHubCategoryView();
  renderGitHubTagsView();
  renderGitHubPath();
  if (els.documentSave) {
    els.documentSave.disabled = true;
  }

  if (els.githubRefresh) {
    els.githubRefresh.addEventListener('click', () => {
      loadGitHubDirectory(githubState.currentPath);
    });
  }
  if (els.githubRoot) {
    els.githubRoot.addEventListener('click', () => {
      loadGitHubDirectory('');
    });
  }

  verifyGitHubConnection()
    .then(() => loadGitHubDirectory(''))
    .catch(() => {
      renderGitHubEntries();
    });
}
