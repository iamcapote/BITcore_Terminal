import { formatFileSize } from './dashboard.utils.js';

export class RemoteBrowserView {
  constructor({
    listElement,
    emptyElement,
    pathElement,
    browserElement,
    onNavigate,
    onFetch,
    onRefresh,
    onUp
  } = {}) {
    this.listElement = listElement || null;
    this.emptyElement = emptyElement || null;
    this.pathElement = pathElement || null;
    this.browserElement = browserElement || null;
    this.onNavigate = typeof onNavigate === 'function' ? onNavigate : () => {};
    this.onFetch = typeof onFetch === 'function' ? onFetch : () => {};
    this.onRefresh = typeof onRefresh === 'function' ? onRefresh : () => {};
    this.onUp = typeof onUp === 'function' ? onUp : () => {};

    this.selectionPath = null;
    this.listing = null;
    this.destroyers = [];
  }

  init() {
    if (this.listElement) {
      const handler = (event) => {
        const entry = event.target.closest('[data-remote-entry]');
        if (!entry) {
          return;
        }
        event.preventDefault();
        const type = entry.getAttribute('data-type');
        const path = entry.getAttribute('data-path') || '';
        if (type === 'dir') {
          this.onNavigate(path);
        } else {
          this.onFetch(path);
        }
      };
      this.listElement.addEventListener('click', handler);
      this.destroyers.push(() => this.listElement.removeEventListener('click', handler));
    }

    if (this.browserElement) {
      const handler = (event) => {
        const control = event.target.closest('[data-remote-action]');
        if (!control) {
          return;
        }
        event.preventDefault();
        const action = control.getAttribute('data-remote-action');
        switch (action) {
          case 'refresh':
            this.onRefresh();
            break;
          case 'up':
            this.onUp();
            break;
          default:
            break;
        }
      };
      this.browserElement.addEventListener('click', handler);
      this.destroyers.push(() => this.browserElement.removeEventListener('click', handler));
    }
  }

  setSelection(path) {
    this.selectionPath = path ? String(path) : null;
    if (this.listing) {
      this.render(this.listing, { selectionPath: this.selectionPath });
    }
  }

  render(listing, { selectionPath, pathOverride } = {}) {
    this.listing = listing || null;
    if (typeof selectionPath === 'string') {
      this.selectionPath = selectionPath;
    }

    if (!this.listElement) {
      return;
    }

    const entries = Array.isArray(listing?.entries) ? listing.entries : [];
    const path = typeof pathOverride === 'string'
      ? pathOverride
      : (listing?.path ?? '');

    this.renderPath(path);
    this.toggleUpControl(path);

    this.listElement.innerHTML = '';

    if (!listing) {
      this.showEmpty('Run “List directory” to browse the remote repository.');
      return;
    }

    if (entries.length === 0) {
      this.showEmpty('No entries found at this path.');
      return;
    }

    this.hideEmpty();
    this.listElement.hidden = false;
    this.listElement.scrollTop = 0;

    const fragment = document.createDocumentFragment();
    const sorted = entries.slice().sort((a, b) => {
      const order = (a?.type === 'dir' ? 0 : 1) - (b?.type === 'dir' ? 0 : 1);
      if (order !== 0) {
        return order;
      }
      return (a?.name || a?.path || '').localeCompare(b?.name || b?.path || '');
    });

    sorted.forEach((entry) => {
      const repoPath = entry?.path || entry?.name || '';
      const type = entry?.type === 'dir' ? 'dir' : 'file';
      const item = document.createElement('li');
      item.className = 'github-sync-remote-item';
      item.dataset.remoteEntry = 'true';
      item.dataset.type = type;
      item.dataset.path = repoPath;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'github-sync-remote-item__button';
      button.textContent = entry?.name || repoPath || '(unknown)';
      if (this.selectionPath && this.selectionPath === repoPath) {
        button.classList.add('is-selected');
      }

      const meta = document.createElement('span');
      meta.className = 'github-sync-remote-meta';
      meta.textContent = type === 'dir' ? 'DIR' : formatFileSize(entry?.size);

      item.appendChild(button);
      item.appendChild(meta);
      fragment.appendChild(item);
    });

    this.listElement.appendChild(fragment);
  }

  renderPath(path) {
    if (!this.pathElement) {
      return;
    }
    const displayPath = path ? `/${String(path).replace(/^\/+/g, '')}` : '/';
    this.pathElement.textContent = `Remote: ${displayPath}`;
  }

  toggleUpControl(path) {
    if (!this.browserElement) {
      return;
    }
    const upButton = this.browserElement.querySelector('[data-remote-action="up"]');
    if (!upButton) {
      return;
    }
    const sanitized = path ? String(path) : '';
    const segments = sanitized.split('/').filter(Boolean);
    upButton.disabled = segments.length === 0;
  }

  showEmpty(message) {
    if (this.emptyElement) {
      this.emptyElement.textContent = message;
      this.emptyElement.hidden = false;
    }
    this.listElement.hidden = true;
  }

  hideEmpty() {
    if (this.emptyElement) {
      this.emptyElement.hidden = true;
    }
  }

  destroy() {
    while (this.destroyers.length) {
      const dispose = this.destroyers.pop();
      try {
        dispose?.();
      } catch (error) {
        console.warn('[RemoteBrowserView] dispose failed', error);
      }
    }
  }
}
