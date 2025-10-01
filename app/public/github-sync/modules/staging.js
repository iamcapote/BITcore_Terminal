const noop = () => {};

export class StagingManager {
  constructor({ logger = console } = {}) {
    this.logger = logger ?? { error: noop };
    this.files = new Map();
    this.activePath = null;
    this.listeners = new Map();
  }

  on(event, handler) {
    if (typeof handler !== 'function') {
      return () => {};
    }
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event);
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit(event, detail) {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    handlers.forEach((handler) => {
      try {
        handler(detail);
      } catch (error) {
        this.logger?.error?.('[StagingManager] listener failed', error);
      }
    });
  }

  stageFile({ path, content, origin = 'remote', sha = null, ref = null } = {}) {
    if (!path) {
      throw new Error('stageFile requires a path.');
    }
    const normalizedPath = String(path).trim();
    if (!normalizedPath) {
      throw new Error('stageFile requires a non-empty path.');
    }
    const record = {
      path: normalizedPath,
      content: typeof content === 'string' ? content : '',
      originalContent: typeof content === 'string' ? content : '',
      origin,
      sha,
      ref,
      updatedAt: Date.now()
    };
    this.files.set(normalizedPath, record);
    if (!this.activePath) {
      this.activePath = normalizedPath;
      this.emit('active-change', { path: this.activePath, file: this.getActive() });
    }
    this.emit('change', this.toArray());
    return record;
  }

  stageBlank(path, { template = '', origin = 'local' } = {}) {
    return this.stageFile({ path, content: template, origin });
  }

  updateContent(path, content) {
    if (!this.files.has(path)) {
      throw new Error(`No staged file '${path}' to update.`);
    }
    const record = this.files.get(path);
    record.content = typeof content === 'string' ? content : '';
    record.updatedAt = Date.now();
    this.files.set(path, record);
    this.emit('change', this.toArray());
    if (this.activePath === path) {
      this.emit('active-change', { path, file: { ...record } });
    }
    return record;
  }

  setActive(path) {
    if (path === this.activePath) {
      return this.getActive();
    }
    if (path && !this.files.has(path)) {
      throw new Error(`Cannot activate unstaged file '${path}'.`);
    }
    this.activePath = path || null;
    this.emit('active-change', { path: this.activePath, file: this.getActive() });
    return this.getActive();
  }

  remove(path) {
    if (!this.files.has(path)) {
      return false;
    }
    this.files.delete(path);
    if (this.activePath === path) {
      const [nextPath] = this.files.keys();
      this.activePath = nextPath ?? null;
      this.emit('active-change', { path: this.activePath, file: this.getActive() });
    }
    this.emit('change', this.toArray());
    return true;
  }

  clear() {
    this.files.clear();
    this.activePath = null;
    this.emit('change', []);
    this.emit('active-change', { path: null, file: null });
  }

  has(path) {
    return this.files.has(path);
  }

  get(path) {
    const record = this.files.get(path);
    if (!record) {
      return null;
    }
    return { ...record };
  }

  getActive() {
    if (!this.activePath) {
      return null;
    }
    return this.get(this.activePath);
  }

  toArray() {
    return Array.from(this.files.values()).map((record) => ({ ...record }));
  }

  isDirty(path) {
    const record = this.files.get(path);
    if (!record) {
      return false;
    }
    return record.content !== record.originalContent;
  }

  dirtyEntries() {
    return this.toArray().filter((record) => record.content !== record.originalContent);
  }
}
