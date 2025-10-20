<!--
Why: Establish filesystem boundaries so agents stay confined while operators retain full control and parity across CLI and GUI workflows.
What: Describes directory layout, Superfile-inspired navigation, programmatic APIs, and security guarantees.
How: Lists structural rules, TUI behaviors, zoxide integration, tooling examples, and REST endpoints that must be implemented.
-->

# File System Management

## Layout & Isolation Doctrine

- `framework/` — immutable runtime assets (agents, tools, configs). Mounted read-only inside computers.
- `projects/` — operator and agent artefacts (missions, sites, datasets). Each mission receives `projects/<mission-id>/` with subfolders `inputs/`, `outputs/`, `logs/`.
- `computers/` — environment images (`seed/`, `cache/`, `catalog/`). Deeper nesting and hashed names make blind traversal by agents harder.
- `plugins/` — extension bundles; each plugin owns `plugins/<plugin-id>/{manifest.json, lib/, assets/}`. Sandboxed by default.
- `users/` — per-operator preferences, API keys, history. Agents only interact via tool interfaces (no direct FS write).
- `sandbox/` — ephemeral staging area for risky operations; auto-pruned.

Isolation rules:
- Agents see `/workspace` symlinked to `projects/<mission>/` plus a read-only bind to `/framework`.
- `computers/` and `plugins/` stay outside of `/workspace` to reduce accidental tampering.
- Sensitive archives live inside double-nested directories (e.g., `users/.vault/archive/2025/10/`) to make indiscriminate deletion unlikely.
- CLI and GUI expose helpers (`bitcore fs map`, Superfile panels) so humans navigate easily while agents stay within contractual paths.

## Superfile Integration

**Vision:** Agent and human navigate files identically—multi-panel TUI, keyboard shortcuts, fuzzy finding, real-time preview.

### TUI Features (Port from Superfile Go → Node/React)

#### 1. Multi-Panel Layout
```
┌─────────────────┬─────────────────┬─────────────────┐
│   Panel 1       │   Panel 2       │   Preview       │
│   /workspace    │   /missions     │   [file.md]     │
│                 │                 │   ───────────   │
│ > file1.txt     │ > mission1.json │   # Heading     │
│   file2.md      │   mission2.json │   Content...    │
│   folder1/      │   archive/      │                 │
│   folder2/      │                 │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

**Keyboard Nav:**
- `Tab`: Switch panel focus
- `j/k` or `↓/↑`: Navigate files
- `Enter`: Open file/directory
- `h` or `←`: Parent directory
- `l` or `→`: Enter directory/preview file
- `/`: Search current directory
- `z`: Zoxide fuzzy finder (jump to frequent dirs)
- `n`: New file/directory
- `d`: Delete (with confirmation)
- `r`: Rename
- `y/p`: Yank (copy) / Paste
- `?`: Help menu

#### 2. File Preview
- **Text files:** Syntax highlighted (via ansichroma or similar)
- **Images:** ASCII art or pixel preview (via image-to-ascii)
- **JSON:** Pretty-printed, collapsible tree
- **Markdown:** Rendered preview
- **Binary:** Hex dump

#### 3. Zoxide Integration
**What is Zoxide?** Fuzzy directory jumper. Tracks frequently visited directories, allows instant jump via substring match.

**Example:**
```bash
# User has visited:
# /workspace/missions/archives/2025-10/
# /workspace/app/infrastructure/ai/
# /workspace/tests/integration/

# User types 'z mis'
# Zoxide suggests: /workspace/missions/
# User types 'z ai'
# Zoxide suggests: /workspace/app/infrastructure/ai/
```

**Implementation:**
```javascript
// app/features/file-browser/zoxide.service.mjs
import { spawn } from 'child_process';

export async function zoxideQuery(query) {
  return new Promise((resolve, reject) => {
    const proc = spawn('zoxide', ['query', query]);
    let output = '';
    
    proc.stdout.on('data', data => output += data);
    proc.on('close', code => {
      if (code === 0) resolve(output.trim());
      else reject(new Error(`Zoxide query failed: ${query}`));
    });
  });
}

export async function zoxideAdd(path) {
  return new Promise((resolve, reject) => {
    const proc = spawn('zoxide', ['add', path]);
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`Zoxide add failed: ${path}`));
    });
  });
}
```

#### 4. Agent API (Programmatic Access)
```javascript
// Agent uses file_browser tool
await agent.callTool('file_browser', {
  action: 'list',
  path: '/workspace'
});
// Returns: { files: [{name: 'file1.txt', type: 'file', size: 1024, ...}] }

await agent.callTool('file_browser', {
  action: 'search',
  path: '/workspace',
  query: '*.test.mjs'
});
// Returns: { files: ['auth.test.mjs', 'chat.test.mjs', ...] }

await agent.callTool('file_browser', {
  action: 'preview',
  path: '/workspace/README.md'
});
// Returns: { content: '# BITcore Terminal\n\n...', type: 'markdown' }
```

## File Operations API

**Base Path:** `/api/files/*`

**Endpoints:**
- `GET /api/files/list?path=/workspace` → List directory
- `GET /api/files/read?path=/workspace/file.txt` → Read file
- `POST /api/files/write` (body: { path, content }) → Write file
- `DELETE /api/files/delete?path=/workspace/old.txt` → Delete file
- `POST /api/files/mkdir` (body: { path }) → Create directory
- `POST /api/files/search` (body: { path, query }) → Search files
- `GET /api/files/preview?path=/workspace/image.png` → Get preview (base64 for images, syntax-highlighted for code)

**Security:**
- Sandboxed to agent's workspace directory
- No access to `/etc`, `/root`, system directories
- Symlink following disabled
- Rate limited (100 ops/min)
