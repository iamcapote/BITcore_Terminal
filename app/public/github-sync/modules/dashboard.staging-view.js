import { formatTimestamp } from './dashboard.utils.js';

export class StagingPanelView {
  constructor({
    root,
    listElement,
    editorElement,
    pathInput,
    originLabel,
    dirtyLabel,
    updatedLabel,
    removeButton,
    onToolbarAction,
    onEditorInput,
    onSelect
  } = {}) {
    this.root = root || null;
    this.listElement = listElement || null;
    this.editorElement = editorElement || null;
    this.pathInput = pathInput || null;
    this.originLabel = originLabel || null;
    this.dirtyLabel = dirtyLabel || null;
    this.updatedLabel = updatedLabel || null;
    this.removeButton = removeButton || null;

    this.onToolbarAction = typeof onToolbarAction === 'function' ? onToolbarAction : () => {};
    this.onEditorInput = typeof onEditorInput === 'function' ? onEditorInput : () => {};
    this.onSelect = typeof onSelect === 'function' ? onSelect : () => {};

    this.editorSyncing = false;
    this.destroyers = [];
  }

  init() {
    if (this.root) {
      const handler = (event) => {
        const actionTarget = event.target.closest('[data-staging-action]');
        if (!actionTarget) {
          return;
        }
        event.preventDefault();
        const action = actionTarget.getAttribute('data-staging-action');
        if (action) {
          this.onToolbarAction(action);
        }
      };
      this.root.addEventListener('click', handler);
      this.destroyers.push(() => this.root.removeEventListener('click', handler));
    }

    if (this.editorElement) {
      const handler = (event) => {
        if (this.editorSyncing) {
          return;
        }
        this.onEditorInput(event.target.value);
      };
      this.editorElement.addEventListener('input', handler);
      this.destroyers.push(() => this.editorElement.removeEventListener('input', handler));
    }
  }

  renderList(files, activePath) {
    if (!this.listElement) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const sortedFiles = Array.isArray(files)
      ? files.slice().sort((a, b) => a.path.localeCompare(b.path))
      : [];

    if (sortedFiles.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'github-sync-staging-empty';
      empty.textContent = 'Nothing staged yet. Fetch a file or create a new one to begin.';
      fragment.appendChild(empty);
    } else {
      sortedFiles.forEach((file) => {
        const item = document.createElement('li');
        item.className = 'github-sync-staging-item';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'github-sync-staging-item__button';
        button.textContent = file.path;
        if (activePath && activePath === file.path) {
          button.classList.add('is-active');
        }
        button.addEventListener('click', () => this.onSelect(file.path));

        const badge = document.createElement('span');
        const dirty = Boolean(file.dirty);
        badge.className = `github-sync-staging-badge ${dirty ? 'is-dirty' : 'is-clean'}`;
        badge.textContent = dirty ? 'Dirty' : 'Clean';

        item.appendChild(button);
        item.appendChild(badge);
        fragment.appendChild(item);
      });
    }

    this.listElement.innerHTML = '';
    this.listElement.appendChild(fragment);
  }

  renderActive(file) {
    if (!this.editorElement) {
      return;
    }

    this.editorSyncing = true;
    if (!file) {
      this.editorElement.value = '';
      this.editorElement.setAttribute('disabled', 'true');
      if (this.pathInput) {
        this.pathInput.value = '';
      }
    } else {
      this.editorElement.removeAttribute('disabled');
      this.editorElement.value = file.content ?? '';
      if (this.pathInput) {
        this.pathInput.value = file.path;
      }
    }
    this.editorSyncing = false;
  }

  updateMeta({ origin, dirty, updatedAt }) {
    if (this.originLabel) {
      this.originLabel.textContent = origin ? `Origin: ${origin}` : 'Origin: —';
    }
    if (this.dirtyLabel) {
      const isDirty = Boolean(dirty);
      this.dirtyLabel.textContent = isDirty ? 'Dirty' : 'Clean';
      this.dirtyLabel.dataset.state = isDirty ? 'dirty' : 'clean';
    }
    if (this.updatedLabel) {
      if (updatedAt) {
        this.updatedLabel.hidden = false;
        this.updatedLabel.textContent = `Updated: ${formatTimestamp(updatedAt)}`;
      } else {
        this.updatedLabel.hidden = true;
        this.updatedLabel.textContent = 'Updated: —';
      }
    }
  }

  setButtonsState({ hasActive }) {
    if (this.removeButton) {
      this.removeButton.disabled = !hasActive;
    }
    if (this.root) {
      const refreshButton = this.root.querySelector('[data-staging-action="refresh-active"]');
      if (refreshButton) {
        refreshButton.disabled = !hasActive;
      }
    }
  }

  destroy() {
    while (this.destroyers.length) {
      const dispose = this.destroyers.pop();
      try {
        dispose?.();
      } catch (error) {
        console.warn('[StagingPanelView] dispose failed', error);
      }
    }
  }
}
