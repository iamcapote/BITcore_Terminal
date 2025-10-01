/**
 * Research GitHub Rendering Layer
 * Why: Render GitHub explorer, activity log, and document viewer surfaces for the research dashboard.
 * What: Provides focused DOM update helpers that map the shared GitHub state into interactive UI elements.
 * How: Reads from `githubState` and cached `els` references while delegating navigation/editing to the GitHub orchestration module.
 */
function renderGitHubStatus(text, state = 'pending') {
  if (!els.githubStatus) return;
  els.githubStatus.textContent = text;
  els.githubStatus.classList.remove('connected', 'disconnected');
  if (state === 'connected') {
    els.githubStatus.classList.add('connected');
  } else if (state === 'error') {
    els.githubStatus.classList.add('disconnected');
  }
}

function renderGitHubPath() {
  if (!els.githubPath) return;
  const display = githubState.currentPath ? `/${githubState.currentPath}` : '/';
  els.githubPath.textContent = display;
}

function renderGitHubActivity() {
  if (!els.githubActivity) return;
  els.githubActivity.innerHTML = '';

  if (!githubState.audit.length) {
    const placeholder = document.createElement('div');
    placeholder.className = 'telemetry-empty';
    placeholder.textContent = 'GitHub operations will appear here.';
    els.githubActivity.appendChild(placeholder);
    return;
  }

  const fragment = document.createDocumentFragment();
  githubState.audit.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'github-activity-entry';

    const level = document.createElement('span');
    level.className = `github-activity-level level-${entry.level}`;
    level.textContent = entry.level.toUpperCase();

    const message = document.createElement('span');
    message.className = 'github-activity-message';
    message.textContent = entry.message;

    const time = document.createElement('time');
    time.className = 'github-activity-time';
    time.dateTime = new Date(entry.timestamp).toISOString();
    time.textContent = formatRelativeTime(entry.timestamp);

    item.append(level, message, time);
    fragment.appendChild(item);
  });

  els.githubActivity.appendChild(fragment);
}

function renderGitHubEntries() {
  if (!els.githubTree) return;
  els.githubTree.innerHTML = '';

  if (githubState.loadingDirectory || githubState.verifying) {
    const loading = document.createElement('div');
    loading.className = 'telemetry-empty';
    loading.textContent = githubState.loadingMessage || 'Loading…';
    els.githubTree.appendChild(loading);
    return;
  }

  if (githubState.error) {
    const error = document.createElement('div');
    error.className = 'telemetry-empty';
    error.textContent = githubState.error.message || 'Unable to load repository data.';
    els.githubTree.appendChild(error);
    return;
  }

  if (!githubState.entries.length) {
    const empty = document.createElement('div');
    empty.className = 'telemetry-empty';
    empty.textContent = 'No files found in this directory.';
    els.githubTree.appendChild(empty);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'research-tree';

  const sorted = [...githubState.entries].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === 'dir' ? -1 : 1;
  });

  sorted.forEach((entry) => {
    const item = document.createElement('li');
    item.className = `research-tree-item ${entry.type}`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'research-tree-button';
    button.textContent = entry.type === 'dir' ? `${entry.name}/` : entry.name;
    button.addEventListener('click', () => handleGitHubEntry(entry));

    item.appendChild(button);

    if (entry.type === 'file' && Number.isFinite(entry.size)) {
      const size = document.createElement('span');
      size.className = 'research-tree-meta';
      const kb = Math.max(1, Math.round(entry.size / 1024));
      size.textContent = `${kb} KB`;
      item.appendChild(size);
    }

    list.appendChild(item);
  });

  els.githubTree.appendChild(list);
}

function renderGitHubCategoryView() {
  if (!els.githubCategory) return;
  els.githubCategory.innerHTML = '';

  if (githubState.currentPath) {
    const info = document.createElement('div');
    info.className = 'telemetry-empty';
    info.textContent = 'Categories are available from the root directory.';
    els.githubCategory.appendChild(info);
    return;
  }

  const directories = githubState.entries.filter((entry) => entry.type === 'dir');
  if (!directories.length) {
    const info = document.createElement('div');
    info.className = 'telemetry-empty';
    info.textContent = 'No categories detected yet.';
    els.githubCategory.appendChild(info);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'research-category-list';
  directories.forEach((dir) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'research-tree-button';
    button.textContent = dir.name;
    button.addEventListener('click', () => handleGitHubEntry(dir));
    item.appendChild(button);
    list.appendChild(item);
  });
  els.githubCategory.appendChild(list);
}

function renderGitHubTagsView() {
  if (!els.githubTags) return;
  els.githubTags.innerHTML = '';
  const info = document.createElement('div');
  info.className = 'telemetry-empty';
  info.textContent = 'Tag insights will appear once documents include metadata.';
  els.githubTags.appendChild(info);
}

function renderDocumentViewer(file) {
  if (!file) return;
  if (els.documentViewer) {
    els.documentViewer.classList.remove('hidden');
  }
  if (els.documentTitle) {
    els.documentTitle.textContent = file.name || 'Document';
  }
  if (els.documentCategories) {
    const segments = file.path ? file.path.split('/').slice(0, -1) : [];
    els.documentCategories.textContent = segments.length ? segments.join(' / ') : '—';
  }
  if (els.documentTags) {
    els.documentTags.textContent = 'Tags metadata unavailable';
  }
  exitEditMode();
  if (els.documentContent) {
    els.documentContent.textContent = file.content || '';
  }
  if (els.documentSave) {
    els.documentSave.disabled = false;
    els.documentSave.textContent = 'Save to GitHub';
  }
}
