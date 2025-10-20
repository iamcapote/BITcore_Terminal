<!--
Why: Define how BITcore agents select, bootstrap, and persist computer environments so rebuild-from-zero guarantees remain intact.
What: Documents the bootstrap wizard, curated catalog, custom builds, switching tool, and disaster recovery flow.
How: Describes catalog entries, provides implementation snippets, and outlines persistence strategies operators must follow.
-->

# Computer Environment System

## Philosophy

Traditional agent systems run in a single, fixed environment. BITcore agents **choose their computer** based on task requirements, time budgets, and resource ceilings.

## Bootstrap Wizard (Rebuild-from-Zero)

1. `pnpm exec bitcore start --bootstrap` launches an interactive wizard.
2. Wizard steps:
   - Detect host resources (CPU, RAM, GPU, disk) and recommend a baseline.
   - Let the operator pick distros to cache locally (SeedCore, TinyCore, Debian Slim, Kali, Alpine, Arch, custom URLs).
   - Offer optional extras: `ollama` daemon, `qemu-img`, browser bundle, GPU runtime, language packs.
   - Materialize `app/config/computers.catalog.json` with checksums, registries, and package manifests.
   - Generate `app/config/computers.seed.sh` that can recreate SeedCore from scratch (busybox + curl + git + node + python + deno + jq + ripgrep).
3. Wizard stores artifacts inside `computers/seed/` so wiping all containers still leaves the recipe to rebuild them 1:1.

## Environment Catalog

#### 1. SeedCore Minimal (Default Baseline)
**Use Cases:** Fast boot, deterministic automation, reconstruction after wipe  
**Features:**
- Derived from TinyCore with glibc; boot in <3 seconds, <120MB disk, ~180MB RAM.
- Preloads busybox, curl, git, unzip, jq, ripgrep, node 22 (glibc build), python 3.12, deno, bun, dash shell.
- Optional toggles for `ollama` and `wasmtime`; both lazily downloaded.
- Hardened filesystem: `/workspace` for projects, `/framework` for BITcore runtime, `/tmp` tmpfs.
- Immutable base snapshot stored as `computers/seed/seedcore.squashfs`.

**Agent Selection Logic:**
```javascript
if (!task.requiresSecurityToolkit && !task.requiresDesktop) {
  environment = 'seedcore';
}
```

#### 2. TinyCore Micro (Worker Swarms)
**Use Cases:** High fan-out specialist swarms, burstable crawlers, iterative testing  
**Features:**
- 45MB compressed image with musl tooling and busybox base.
- Adds curl, git, jq, ripgrep, headless chromium optional toggle for scraping.
- Ships with cooperative rate limiter daemon so coordinator can throttle swarm scale-outs.
- Favors overlayfs snapshots for extremely fast provisioning (<1s spin-up).

#### 3. Debian Slim (Coordinator Default)
**Use Cases:** Mission orchestration, build pipelines, general-purpose automation  
**Features:**
- Debian bookworm-slim + essential build tooling (build-essential, python3, node 22).
- Preinstall `docker-cli`, `tmate`, and audit utilities for mission oversight.
- Includes `systemd`-less init harness to keep container footprint low while supporting background services.
- Acts as root for nested environments; grants gRPC loopback access to child agents.

#### 4. Kali Security (Sentinel)
**Use Cases:** Artefact validation, security assessments, red-team style sweeps  
**Features:**
- Kali rolling snapshot trimmed to CLI tooling (nmap, sqlmap, yara, wfuzz, nuclei).
- Adds BITcore policy packs and `policy_lint` adapters for security audits.
- Comes with restricted outbound networking profiles; sentinel agents request explicit elevation through coordinator.

#### 5. Alpine Musl
**Use Cases:** Musl builds, container hardening, minimal API hosting  
**Features:**
- 60MB image, <120MB RAM.
- Busybox, apk, openrc; Node.js and Python compiled against musl.
- Ideal for embedding inside other orchestrations or to cross-compile static binaries.

#### 6. Arch Rolling
**Use Cases:** Cutting-edge packages, rust nightly, bleeding-edge libraries  
**Features:**
- Pacman with small curated repo; updates pinned via snapshot manifest.
- Preloads rustup nightly, clang, zig, go.
- Operators can snapshot to freeze state per mission.

#### 7. Custom Compose (Agent-Designed)
**Use Cases:** Specialized stacks (e.g., WebAssembly pipelines, robotics toolchains)  
**Features:**
- Agent submits Dockerfile or OCI manifest; builder enforces whitelist (no privileged instructions by default).
- Cached layers stored in `computers/cache/` for reuse by other agents.
- Example (no heavy ML by default):
  ```dockerfile
  FROM debian:bookworm-slim
  RUN apt-get update \
      && apt-get install -y --no-install-recommends build-essential cmake nodejs npm \
      && npm install -g @bitcore/cli \
      && apt-get clean && rm -rf /var/lib/apt/lists/*
  WORKDIR /workspace
  ```
- Agents can request `extras: ['onnxruntime', 'sentencepiece']` which are resolved through curated installers.

#### 8. Nested / Parallel
**Use Cases:** Hierarchical orchestration, A/B experiments, safe sandboxes  
**Features:**
- Coordinator may run in Debian Slim and spawn TinyCore workers, or combine SeedCore + Alpine clusters.
- Each child environment receives its own overlay filesystem; parent communicates via gRPC over loopback.
- Snapshot + restore API allows freezing specialist state between iterations.

**Example Hierarchy:**
```
Coordinator (Debian Slim) → mission planner
  ├── Specialist A (TinyCore) → web crawling shard 1
  ├── Specialist B (TinyCore) → web crawling shard 2
  ├── Specialist C (SeedCore) → markdown summarizer with ollama llama3
  └── Sentinel (Kali)        → validates security posture of generated artifacts
```

## Environment Selector Tool

**Tool Name:** `select_computer`  
**Purpose:** Agent requests environment change mid-task without human intervention.  
**Usage:**
```javascript
await agent.callTool('select_computer', {
  environment: 'tinycore', // seedcore | tinycore | debian | kali | alpine | arch | custom | nested
  dockerfile: null, // Required for custom
  extras: ['ollama'], // Optional extras from catalog
  reason: 'Switching to micro footprint for swarm execution'
});
```

**Implementation:**
```javascript
// app/tools/select-computer.tool.mjs
export async function executeSelectComputer(agent, { environment, dockerfile, extras = [], reason }) {
  agent.log(`Requesting environment switch: ${reason}`);

  if (environment === 'custom' && !dockerfile) {
    throw new Error('Custom environment requires dockerfile');
  }

  const checkpoint = await agent.serializeState();

  const image = environment === 'custom'
    ? await buildCustomImage(dockerfile, extras)
    : await resolveCatalogImage(environment, extras);

  const containerId = await docker.createContainer({
    image,
    volumes: [`${agent.workDir}:/workspace`, `${agent.frameworkDir}:/framework:ro`],
    env: agent.getEnvVars(),
    HostConfig: {
      NanoCPUs: agent.computeBudget.cpuNano,
      Memory: agent.computeBudget.ramBytes
    }
  });

  await docker.start(containerId);
  await restoreAgentState(containerId, checkpoint);

  agent.log(`Switched to ${environment} (${containerId}) with extras ${extras.join(', ') || 'none'}`);
  return { containerId, environment, extras };
}
```

## Environment Persistence

**Scenarios:**
1. **Ephemeral (default):** Container removed after mission completion; seed snapshot remains intact.
2. **Cached:** Agent or operator pins the built image under `computers/cache/*.tar.zst` for reuse.
3. **Named:** Agent registers the environment under `computers/catalog/<name>.json` so other missions can opt-in.

**Agent Request Example:**
```javascript
await agent.callTool('select_computer', {
  environment: 'custom',
  dockerfile: `
    FROM alpine:3.20
    RUN apk add --no-cache clang git nodejs npm
  `,
  extras: ['wasmtime'],
  persist: 'wasm-builder',
  reason: 'Need reproducible WASM toolchain for multiple site builds'
});
```

## Disaster Recovery (Total Wipe)

1. `rm -rf computers/cache/* projects/*` (optional wipe of mutable artefacts).
2. Run `pnpm exec bitcore start --bootstrap --from-cache` to rehydrate SeedCore from `computers/seed/seedcore.squashfs` and regenerate catalog entries.
3. Restore plugins and profiles from `plugins/*.tar.zst` bundles (auto-exported nightly).
4. Replay mission logs via `bitcore missions restore <archive.tar.zst>` to rebuild project folders.
5. Re-run `bitcore doctor verify` to ensure every tool, MCP server, and extension matches the contract manifest.

Everything required to rebuild lives under `computers/seed/`, `framework/`, and manifest files tracked in git, so even a bare metal reinstall recreates the engine 1:1.
