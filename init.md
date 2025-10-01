# BITCORE TERMINAL :: SYSTEM INITIALIZATION PROTOCOL
#
# Purpose:
#   This lightweight briefing outlines the conceptual, pre-production initialization sequence
#   for the BITCORE Terminal privacy research agent. It is meant to guide dry-runs and mental
#   rehearsals prior to any production deployment, emphasizing context gathering, guardrail
#   confirmation, and simulation of readiness without mutating the host system.
#
# Invocation:
#   This protocol is executed internally by the BITCORE Terminal bootstrap sequence invoked via
#   `node app/start.mjs` (or `npm start`). It adapts to the active workspace once the agent
#   inspects its runtime configuration, storage roots, and feature toggles.
#   This document is a context map and orchestration blueprint, not a shell script.
#
# Core Directives for Protocol Interpretation:
#   - Reference Paths: Treat `$BITCORE_HOME` as the absolute path to the repository root. The
#     agent should resolve it via `process.cwd()` when started from the project root, or by
#     walking up the directory tree until `package.json` and `app/start.mjs` are found. The file
#     `app/current_app_folder_file_tree.md` can be consulted (or regenerated conceptually via
#     `app/filetree.mjs`) to confirm structure before assuming path correctness.
#
#   - Command Execution: "command" entries are candidate shell probes. Equivalent Node.js or
#     internal inspection methods (e.g., `read_file`, `fs.readdir`) MAY be substituted when they
#     produce the same data without violating safety constraints.
#
#   - Internal Actions: "action" entries describe multi-step operations that typically rely on
#     existing modules (CLI handlers, services, infrastructure clients). They are conceptual and
#     should be satisfied by orchestrating the appropriate code paths rather than shelling out.
#
#   - Operational Policies: "policy" entries encode mandatory behavioral constraints spanning
#     API usage, persistence, and data retention. These policies must be enforced regardless of
#     execution mode (CLI, web, service tests).
#
#   - Information Sources: "source" entries identify the canonical data origin for observability,
#     verification, or recovery. The agent should log the resolved paths/identifiers alongside
#     correlation IDs for traceability.

INIT_SEQUENCE:

  # --- Section: HOST_PREFLIGHT ---
  # Establish baseline awareness of the execution environment without altering it.
  - section: HOST_PREFLIGHT

    description: Mentally confirm host characteristics and clock alignment before simulating workloads.

    steps:
      - description: Note the reported OS family and kernel version to ensure toolchain compatibility.
        action: Read cached environment metadata (e.g., `/etc/os-release`, `os.release()`), documenting findings in the dry-run log without executing shell commands.
        source: OS_INFO

      - description: Confirm logical clock alignment for timestamp coherence across CLI and web telemetry.
        action: Inspect prior `timedatectl` outputs or virtualization metadata, acknowledging any drift for later remediation.
        source: SYSTEM_TIME_INFO


  # --- Section: RESOURCE_BASELINE ---
  # Envision available compute resources to size queues and concurrency for rehearsal runs.
  - section: RESOURCE_BASELINE

    description: Draft a notional resource profile to guide simulated workload planning.

    steps:
      - description: Summarize expected CPU cores, memory footprint, and storage headroom from prior inventory notes.
        action: Reference existing diagnostics (if any) or default container specs to establish provisional limits.
        source: SYSTEM_HARDWARE_METRICS

      - description: Flag any hypothetical bottlenecks (disk saturation, sustained load) that would impact rehearsal flows.
        action: Use historical metrics or assumptions to set alert thresholds; no live polling is required at this stage.
        source: SYSTEM_PERFORMANCE_METRICS


  # --- Section: TOOL_DISCOVERY_AND_API_POLICY ---
  # Reaffirm available modules and policies so simulations stay within intended pathways.
  - section: TOOL_DISCOVERY_AND_API_POLICY

    description: Conceptually map available tooling and reiterate routing constraints for the dry-run.

    steps:
      - description: Review the command registry blueprint to internalize available CLI entry points.
        action: Read `app/commands/index.mjs` (or its generated manifest) and note command names, flags, and guards for simulated invocation.
        source: BITCORE_COMMAND_REGISTRY

      - description: Refresh knowledge of web features, routes, and socket channels.
        action: Skim `app/features/**/routes.mjs` and companion controllers, capturing a mind-map of message types and required context objects.
        source: BITCORE_FEATURE_INDEX

      - description: Restate API routing policy so rehearsal calls follow approved adapters only.
        policy:
          - Brave Search: Route through `app/infrastructure/search/search.providers.mjs` abstractions when role-playing requests.
          - Venice LLM: Leverage `app/infrastructure/ai/venice.llm-client.mjs`; avoid imaginary direct HTTP calls outside infrastructure.
          - GitHub persistence: Use `app/utils/github.utils.mjs` and `app/infrastructure/memory/github-memory.integration.mjs` in all hypotheticals.
          - File context: Prefer `app/utils/research.file-utils.mjs` and `read_file` tooling for simulated content access.
        source: API_ROUTING_POLICY


  # --- Section: SECRET_MANAGEMENT ---
  # Validate secret handling assumptions without touching real credentials.
  - section: SECRET_MANAGEMENT

    description: Rehearse credential flow expectations while keeping storage untouched.

    steps:
      - description: Walk through the intended credential bootstrap using test doubles.
        action: Instantiate `app/features/auth/user-manager.mjs` with ephemeral in-memory storage to confirm encryption/decryption pathways conceptually.
        note: Keep real storage directories untouched during this rehearsal.
        source: USER_MANAGER_VAULT

      - description: Affirm target permission posture for persisted secrets.
        action: Review documented expectations for `${BITCORE_STORAGE_DIR:-$HOME/.bitcore-terminal}` without executing `stat`; log discrepancies for later remediation.
        source: BITCORE_STORAGE_PERMISSIONS


  # --- Section: NETWORK_SECURITY ---
  # Capture intended network guardrails while deferring active scans.
  - section: NETWORK_SECURITY

    description: Document planned firewall and scanning posture for eventual hardening.

    steps:
      - description: Record the expected firewall narrative (which ports should open/closed) based on architecture notes.
        action: Update the dry-run log with the planned `ufw`/security group state; do not run enforcement commands.
        source: FIREWALL_STATUS

      - description: Outline future security scanning cadence and tooling.
        action: Specify which scanners (e.g., `npm audit`, SAST) will run post go-live, capturing ownership and cadence for later activation.
        source: SECURITY_SCANNER_OUTPUT


  # --- Section: CONTEXT_LOADING ---
  # Prime working memory with project knowledge artefacts.
  - section: CONTEXT_LOADING

    description: Curate the conceptual knowledge base required for effective rehearsal.

    steps:
      - description: Catalogue the most relevant guides, docs, and configs by reviewing directory listings mentally or via prior inventories.
        action: Assemble a consolidated note referencing `guides/`, `missions/templates/`, `prompts/`, and `app/config/` assets.
        source: FILE_SYSTEM_SCAN

      - description: Build a conceptual in-memory map linking artefacts to their responsibilities.
        action: Summarize each asset cluster (guides, prompts, missions) and the questions they help answer during rehearsal.
        source: PARSED_CONTEXT_FILES

      - description: Define how this synthesized context would be cached for quick reload later.
        action: Sketch the intended shape of `${BITCORE_STORAGE_DIR:-$HOME/.bitcore-terminal}/cache/context.snapshot.json` without writing to disk.
        output_path: ${BITCORE_STORAGE_DIR:-$HOME/.bitcore-terminal}/cache/context.snapshot.json
        source: SERIALIZED_CONTEXT_MAP

      - description: Identify automation manifests and their triggers conceptually.
        action: Review `missions/` structure to note any `*.cron.json` files for future scheduling.
        source: PROJECT_CRON_MANIFESTS

      - description: Pair each mission/prompt with the environment data it expects.
        action: Trace dependencies (secrets, config) and capture them in rehearsal notes.
        source: PROJECT_SPECIFIC_CONTEXTS

      - description: Maintain awareness of operational scripts without running them.
        action: List notable utilities in `scripts/` directories and describe their intended roles.
        source: SCRIPT_INVENTORY


  # --- Section: CODE_GOVERNANCE_AND_STATE ---
  # Keep auditability top-of-mind while avoiding state mutations.
  - section: CODE_GOVERNANCE_AND_STATE

    description: Reiterate governance expectations for later execution phases.

    steps:
      - description: Clarify how semantic diffs will be captured once mutation begins.
        policy: Upon live initialization, append diffs to `$BITCORE_HOME/logs/code_history/<timestamp>.patch`; no files are touched during the rehearsal.
        source: VERSION_CONTROL_POLICY

      - description: Restate protections for templates and historical scripts.
        policy: Deletions require an explicit `--purge-artifacts` acknowledgement in future operational modes.
        source: CODE_RETENTION_POLICY

      - description: Document the intended backup strategy to be activated post go-live.
        action: Describe the target sync flow between `${BITCORE_STORAGE_DIR:-$HOME/.bitcore-terminal}/data` and `${BITCORE_BACKUP_DIR:-$HOME/.bitcore-terminal-backups}`; defer execution.
        source: BACKUP_VERIFICATION_SYSTEM

      - description: Plan cache hygiene routines conceptually.
        action: Specify purge cadence for files older than seven days without running deletions now.
        source: CACHE_CLEANUP_LOG

      - description: Outline logging fan-out once telemetry sinks are configured.
        action: Note how `app/utils/research.output-manager.mjs` will forward logs to centralized systems when enabled.
        source: CENTRALIZED_LOGGING_INTEGRATION


  # --- Section: STARTUP_VALIDATION_AND_ROLLBACK ---
  # Establish the validation playbook before any commands run for real.
  - section: STARTUP_VALIDATION_AND_ROLLBACK

    description: Define the diagnostic checklist and rollback signals for upcoming real runs.

    steps:
      - description: Document which lint, test, and static analysis suites will run when transitioning to active mode.
        action: List commands (`npm run lint`, `npm test`, targeted Vitest suites) and expected pass criteria without executing them now.
        source: DIAGNOSTIC_TOOL_OUTPUTS

      - description: Define the signal that marks readiness in future executions.
        action: Specify logging format and state file updates that will occur after successful diagnostics.
        source: SYSTEM_READINESS_SIGNAL


  # --- Section: SELF_PRIMING_AND_CONTEXTUALIZATION ---
  # Absorb foundational knowledge to ground upcoming rehearsal dialogue.
  - section: SELF_PRIMING_AND_CONTEXTUALIZATION

    description: Review guiding documents and mental models that inform the agent's behaviour.

    steps:
      - description: Read core directives for BITCORE development philosophy and guardrails.
        command: cat $BITCORE_HOME/AGENTS.md
        source: CORE_DIRECTIVES

      - description: Read system overview and operational guidance.
        command: cat $BITCORE_HOME/README.md
        source: SYSTEM_OVERVIEW

      - description: Load configuration primers and API guides.
        command: cat $BITCORE_HOME/guides/*.md
        source: SYSTEM_PROMPTS_AND_GUIDES

      - description: Review TODO list and mission file tree for immediate priorities and structure.
        command: cat $BITCORE_HOME/todo.md && cat $BITCORE_HOME/app/current_app_folder_file_tree.md
        source: TASK_AND_STRUCTURE_OVERVIEW

      - description: Skim prompt templates and mission presets to internalize vocabulary and flows.
        command: cat $BITCORE_HOME/prompts/*.md && find $BITCORE_HOME/missions/templates -maxdepth 1 -type f -print -exec cat {} \;
        source: CONTEXTUAL_KNOWLEDGE_BASE

      - description: Engage cognitive recall protocols to integrate past interactions and learned patterns.
        action: Query memory adapters (`app/infrastructure/memory/memory.manager.mjs`) and GitHub-backed memories to build a vector of recent sessions, prioritizing high-salience research outcomes.
        source: INTERNAL_MEMORY_RETRIEVAL_PROTOCOL

      - description: Confirm self-priming is complete and system is ready for user commands.
        action: Log the completion of the priming phase and transition the command router to ACCEPTING state.
        source: SELF_PRIMING_STATUS


MINIMUM_RUNTIME_CONTEXT_LOAD:
  description: Conceptual checklist of context that should be mentally loaded for rehearsal readiness.

  elements:
    - Host metadata (CPU cores, RAM, IP, GPU): from `${BITCORE_STORAGE_DIR:-$HOME/.bitcore-terminal}/cache/host_metrics*.json`
    - CLI & Web command registry: from `$BITCORE_HOME/app/commands/index.mjs`
    - Mission templates and cron manifests: from `$BITCORE_HOME/missions/templates/` and `$BITCORE_HOME/missions/**/*.cron.json`
    - Decrypted secrets bundle: loaded on-demand via `app/features/auth/user-manager.mjs`
    - Feature index (routes/controllers): from `$BITCORE_HOME/app/features/`
    - Telemetry and log configuration: from `$BITCORE_HOME/app/config/index.mjs`
    - Core directives: `$BITCORE_HOME/AGENTS.md`
    - Repository roadmap and TODOs: `$BITCORE_HOME/todo.md`
    - Context guides and research docs: `$BITCORE_HOME/guides/*.md`
    - Prompt library: `$BITCORE_HOME/prompts/`
    - Memory persistence state: `${BITCORE_STORAGE_DIR:-$HOME/.bitcore-terminal}/memory/`
    - Recent log excerpts: `${BITCORE_STORAGE_DIR:-$HOME/.bitcore-terminal}/logs/last_run.log` (if present)
    - Version history patches: `$BITCORE_HOME/logs/code_history/`
    - Snapshot state cache: `${BITCORE_STORAGE_DIR:-$HOME/.bitcore-terminal}/state/`


EXECUTION_START:
  description: Conclude the rehearsal by sketching the artefacts needed when activation occurs.

  steps:
    - description: Outline the structure of the future `INIT_CONTEXT_SNAPSHOT.md` artefact.
      action: Draft (on paper or in notes) the intended directory tree, metrics table, and context catalog that will be produced once initialization runs with real side-effects.
      output_file: $BITCORE_HOME/INIT_CONTEXT_SNAPSHOT.md
      content_structure:
        - Directory tree overview (depth 3, system dirs omitted) annotated with purposes.
        - Metrics table headings (hostname, uptime, CPU, RAM, GPU presence, disk free %, load avg 5m, IP, timezone, git SHA, snapshot time).
        - Context catalog linking commands, missions, prompts, guides, storage roots, and telemetry configurations.
      data_principles:
        - Keep content factual, minimal, and machine-readable when ultimately generated.
        - Exclude raw secrets; reference locations only.
        - Maintain consistent headings and table formats for automation.
      purpose: Establishes the blueprint for the canonical snapshot without creating it yet.

    - description: Prepare the message format that will announce readiness in future runs.
      action: Define the short summary (key metrics + snapshot path + READY status) to log or emit once diagnostics pass in the active environment.
      source: SYSTEM_READINESS_REPORT
      await_instructions: true
