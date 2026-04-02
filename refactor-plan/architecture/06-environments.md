<!--
Why: Detail the compute environment, filesystem, and memory systems that back the agent platform.
What: Computer environment system, file system management, and memory architecture details.
How: Preserve canonical infrastructure signals in a single systems-focused file.
Status: active
Last Updated: 2026-02-02
-->

# Environments, Filesystem, and Memory

## 33) Computer Environment System (Detailed Signals)

**Bootstrap Wizard**
- `bitcore start --bootstrap` builds `app/config/computers.catalog.json` + `app/config/computers.seed.sh`.
- Catalog includes SeedCore, TinyCore, Debian Slim, Kali, Alpine, Arch, custom builds.

**Persistence Modes**
- Ephemeral (default), Cached (`computers/cache/*.tar.zst`), Named (`computers/catalog/<name>.json`).

**Select Computer Tool**
- `select_computer` switches environments with state serialization; enforces resource caps.

**Disaster Recovery**
- Seed artifacts in `computers/seed/` guarantee rebuild from zero.

## 33.1) Environment Catalog & Selector Details

**Catalog defaults**
- SeedCore minimal baseline (TinyCore-derived), ultra-fast boot, busybox + curl + git + node + python + deno.
- TinyCore micro for swarms with overlayfs snapshots, optional headless Chromium toggle for scraping, and cooperative rate limiter daemon for swarm throttling.
- Debian Slim for coordinator and build pipelines, preinstall `docker-cli` and `tmate` for mission oversight.
- Kali for security validation with restricted outbound networking.
- Alpine for musl builds; Arch for bleeding-edge toolchains.
- Custom compose via Dockerfile with whitelist enforcement.

**Catalog detail (operational)**
- **SeedCore**: <3s boot, <120MB disk, ~180MB RAM; preloads busybox, curl, git, unzip, jq, ripgrep, node 22 (glibc), python 3.12, deno, bun; optional `ollama` + `wasmtime`; immutable snapshot at `computers/seed/seedcore.squashfs`; hardened `/workspace` + read-only `/framework`.
- **TinyCore**: ~45MB image; musl + busybox; optional headless Chromium; overlayfs snapshots for <1s spin-up; built-in swarm throttle daemon.
- **Debian Slim**: bookworm-slim + build-essential, python3, node 22; includes `docker-cli`, `tmate`, audit tools; systemd-less init harness; parent for nested environments via gRPC loopback.
- **Kali**: trimmed CLI toolset (nmap, sqlmap, yara, wfuzz, nuclei); policy packs + `policy_lint` adapters; restricted outbound networking for sentinel use.
- **Alpine**: ~60MB image, <120MB RAM; musl-based node/python; suited for hardened container builds.
- **Arch**: curated pacman repo; rust nightly, clang, zig, go; snapshot-per-mission pinning.
- **Custom compose**: agent-supplied Dockerfile or OCI manifest; whitelist enforcement; cached layers in `computers/cache/`; supports extras like `onnxruntime`, `sentencepiece` via curated installers.
- **Nested/parallel**: coordinator spawns TinyCore/SeedCore/Alpine workers with isolated overlays; snapshot/restore API for specialist state reuse.

**Selector contract**
- `select_computer` supports `environment`, `extras`, `persist`, and `reason` with state serialization and resource caps.
- Nested execution supported: coordinator environment spawns specialist workers with isolated overlays.

## 33.2) Bootstrap Wizard & Disaster Recovery (Operational Flow)

**Bootstrap wizard steps**
1) Detect host resources (CPU, RAM, GPU, disk) and recommend baseline.
2) Select distros to cache (SeedCore, TinyCore, Debian Slim, Kali, Alpine, Arch, custom URLs).
3) Choose optional extras (`ollama`, `qemu-img`, browser bundle, GPU runtime, language packs).
4) Generate `app/config/computers.catalog.json` with checksums/manifests.
5) Generate `app/config/computers.seed.sh` to rebuild SeedCore from bare metal.

**Disaster recovery path**
- Wipe mutable artefacts → re-run bootstrap `--from-cache` → restore plugins/profiles → replay mission logs → run `bitcore doctor verify`.

## 34) File System Management (Detailed Signals)

**Isolation Layout**
- `framework/`, `projects/`, `computers/`, `plugins/`, `users/`, `sandbox/` with read-only framework mount.
- CLI and GUI expose helpers (`bitcore fs map`, Superfile panels) so operators navigate safely while agents remain sandboxed.

**Superfile TUI Behaviors**
- Multi-panel file browser, preview pane, keyboard-first navigation, zoxide integration.

**File API Endpoints**
- `GET /api/files/list|read|preview`, `POST /api/files/write|mkdir|search`, `DELETE /api/files/delete`.

## 34.1) File Browser UX + Zoxide Details

**TUI workflow**
- Three-pane layout (source, destination, preview) with Vim-style navigation.
- Preview modes: syntax-highlighted text, rendered markdown, ASCII image, JSON tree, hex dump.

**Key map (TUI)**
- `Tab` switch panel, `j/k` or arrows move, `Enter` open, `h/l` parent/enter.
- `/` search, `z` zoxide jump, `n` new file/dir, `d` delete, `r` rename.
- `y` yank, `p` paste, `?` help.

**Zoxide integration**
- `zoxide query` for fast jumps and `zoxide add` on directory changes.
- CLI and TUI share the same jump behavior for parity.

## 34.2) File Browser API Usage (Agent)

**Programmatic access**
- `file_browser` tool supports `list|read|write|delete|mkdir|search|preview` with workspace sandboxing.
- Preview returns syntax-highlighted markdown, JSON trees, or base64 images depending on file type.

## 34.3) File Browser UX Enhancements (Superfile Pattern)

- Plugin-ready keymap profiles with vim defaults.
- Theme packs with tokenized color palettes.
- Auto-update banner with opt-out in config.

**Superfile TUI architecture (Superfile-derived)**
- Bubble Tea model with `Init`, `Update`, `View` cycle; message types: `tea.WindowSizeMsg`, `tea.MouseMsg`, `tea.KeyMsg`, custom `ModelUpdateMessage`.
- Multi-panel file model: `filePanels[]` with `filePanelFocusIndex`; `createNewFilePanel`, `closeFilePanel`, `nextFilePanel`, `previousFilePanel`.
- Preview panel toggleable via `toggleFilePreviewPanel`; width computed from remaining space.
- Sidebar model: pinned directories, search bar, rename flow (`PinnedItemRename`, `ConfirmSidebarRename`, `CancelSidebarRename`).
- Focus states: `sidebarFocus`, `processBarFocus`, `metadataFocus`, `nonePanelFocus`; `returnFocusType` helper.
- Metadata fetch command spawned per update unless `gotModelUpdateMsg` to avoid loops.
- Zoxide integration: `zoxideui.UpdateMsg` applies to modal; shared CLI/TUI jump behavior.
- Mouse wheel handling: `wheelMainAction` for scroll.
- File preview: `getFilePreviewCmd` loads on selection change or resize; `RenderWithPath` returns syntax-highlighted content.
- Width recalculation on panel add/remove: `m.fileModel.width = (fullWidth - sidebarWidth - previewWidth - padding) / panelCount`.

## 35) Memory Architecture (Detailed Signals)

**Three-Tier Memory**
- Working Memory: Graphology in-memory graph for active missions.
- Long-Term Memory: FAISS vector store for persistent summaries/solutions.
- Ontology Memory: optional external graph (Neo4j/Janus/Neptune).

**Vector Adapter Interface**
- Adapter supports `faiss|chroma|qdrant|pgvector` with consistent `insert/search/delete` APIs.
- Default: FAISS for single-instance deployments; Chroma/Qdrant/Pgvector as scale options.

**Adapter contract**
- `insert(text, embedding, metadata)`, `search(query, k, filter)`, `delete(id)`, `count()`, `close()`.

**Vector implementation details (Agent Zero-derived)**
- Default FAISS index: `IndexFlatIP` with cosine-normalized relevance scores.
- Embedding cache uses in-memory byte store keyed by model namespace (`model_name`).
- Inserts assign a generated `id` into document metadata for stable deletes and audits.
- Similarity search supports score thresholds; metadata search supports predicate filters.
- `Memory.Area` enum: `MAIN`, `FRAGMENTS`, `SOLUTIONS`, `INSTRUMENTS` for partitioned storage.
- Index registry: `Memory.index[memory_subdir]` caches loaded FAISS instances.
- Knowledge preload: `preload_knowledge(kn_dirs)` imports documents from configured folders on startup.
- Re-indexing: if embedding model changes, detect mismatch via `embedding.json` meta file and re-embed all docs.
- Document management: `insert_documents(docs)` returns IDs; `delete_documents_by_ids(ids)` removes by ID list.
- `MyFaiss.get_all_docs()` returns full docstore for migrations and re-indexing.

**Configuration example**
- `app/config/memory.json` includes vector `type`, `dimension`, `metric`, and embedding provider/model.

**Consolidation + Retention**
- Nightly or on-demand consolidation merges near-duplicate memories.
- Retain last 30 days; keep high-value memories (referenced >5 times).
- Prune low-relevance memories (similarity < 0.3 for 90 days).

**Memory tool defaults (operational)**
- `memory_load` defaults: threshold 0.7, limit 10, optional metadata filter.
- `memory_forget` deletes by similarity threshold and filter predicate.
- `memory_delete` deletes by explicit ids.
- Collection-based organization: files link to collections; collections scoped to workspaces.

**Sync Contracts**
- Emit `mission:*`, `memory:inserted`, `graph:updated` to ontology bridge.
- Accept `workflow:planned`, `agent:profile_updated`, `secret:stored` inbound events.

## 35.3) Document Ingestion & Vector Admin (Derived)

**Ingestion pipeline**
- Collector → parser → chunker → embed queue → vector store.
- Deduplication before embedding; reranker optional for retrieval.
- Embedding cache for repeated content.

**Chunking & embedding (Chatbot-UI-derived)**
- Semantic splitter with sentence boundaries; overlap strategy for context preservation.
- Chunk metadata: position, source file, tokens.
- Local embeddings via Transformers.js (browser) with server-side OpenAI fallback.
- Vector storage: pgvector with HNSW/IVFFlat index build.

**Retrieval flow (AnythingLLM-derived)**
- Pinned docs injected first; parsed workspace files appended.
- Similarity search with configurable threshold + topN; identifiers filter duplicates.
- Source window backfill keeps citations relevant without overwhelming the model.
- Query-mode short-circuit when no embeddings and no pinned context.

**Vector admin surfaces**
- Namespace manager (copy/migrate namespaces across vector DBs).
- Chunk viewer/editor with metadata filters.
- Regression testing hooks for retrieval quality.

## 35.4) Local LLM Hosting (Derived)

- Single-host deployment with model storage volume.
- Auto-scale-to-zero for GPU hosts with warm-up guardrails.
- Model lifecycle: pull → load → unload → purge with VRAM caps.

## 35.5) Secrets Store & Streaming Redaction (Derived)

**Secrets file contract**
- Store in `tmp/secrets.env` with comment + ordering preservation.
- Placeholders use `§§secret(KEY)` aliases; keys are normalized to uppercase.

**Masked editing and merge behavior**
- UI submits masked values as `***`; server preserves existing values.
- Keys omitted in submitted content are deleted.
- New masked-only keys are ignored to prevent empty secret creation.

**Streaming redaction**
- Streaming filter masks full values inline and buffers partial prefixes to prevent leaks.
- On finalize, any unresolved partial is replaced with `***`.

## 35.1) Memory Consolidation, WAL, and Monitoring

**Persistence coordinator**
- Atomic mission + vector writes with WAL replay on restart.
- Write-once mission snapshots with timestamp suffixes.

**Consolidation**
- Merge near-duplicate memories; keep high-value memories referenced >5 times.
- Retain last 30 days; prune low-relevance items (similarity < 0.3) after 90 days.

**Monitoring**
- Metrics: `sync.events_published`, `sync.events_processed`, `sync.latency`, `sync.conflicts_detected`, `memory.faiss_size`.
- Alert thresholds: sync lag >500ms, conflict rate >10/min, FAISS index >1 GB.

## 35.2) Memory Events & Conflict Resolution (Examples)

**Example events**
- `mission:started`, `mission:step_completed`, `mission:completed` include mission telemetry and timestamps.
- `memory:inserted` includes memory id, tags, and mission linkage.
- `graph:updated` carries node/edge delta payloads.

**Conflict resolution**
- Last-write-wins with timestamp comparison; UI shows diffs when conflicts occur.
