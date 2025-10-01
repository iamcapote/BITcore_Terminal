# Retrieval & RAG Enhancements Roadmap

_Last updated: September 2025_

This roadmap captures the retrieval-focused capabilities we intend to layer onto the BITcore research stack across CLI and Web surfaces. Each capability follows our contract-first principle (define inputs, outputs, error modes, and performance envelopes before implementation) and must remain configurable through both the terminal commands and the web UI.

Capabilities are grouped by lifecycle stage: ingest → search → ranking → context delivery → evaluation. For each item we highlight the primary goal, how it fits into the current architecture, and the minimum surfaces that must expose corresponding toggles or configuration knobs.

---

## 1. Ingestion & Chunk Strategy

| Capability | Primary Goal | Integration Points | Notes & Dependencies |
| --- | --- | --- | --- |
| **Sliding Window Chunking** | Preserve cross-boundary context by overlapping fixed-size windows. | `app/features/research/preprocess` (new helper), chunk metadata in memory store. | Configurable `windowSize`/`overlap` defaults; expose via `/research --chunk-window` and web settings.
| **Semantic Chunking** | Split documents on semantic boundaries instead of raw token counts. | `utils/semantic-chunker.mjs` (new), Venice embedding client. | Requires embedding scorer; add validation tests in `tests/research-chunker.test.mjs`.
| **Document Hierarchies** | Track document → section → paragraph lineage for smarter recall. | Memory schema update, retrieval DTOs. | Persist hierarchy IDs; update serialization in GitHub sync payloads.
| **Metadata Enrichment** | Attach author, timestamps, tags, and feature flags at ingest. | `app/features/memory` ingest pipeline, validation schema. | Enforce required fields; extend CLI `/memory ingest` prompts.

## 2. Query Generation & Retrieval

| Capability | Primary Goal | Integration Points | Notes & Dependencies |
| --- | --- | --- | --- |
| **Query Expansion** | Generate paraphrases and synonyms to widen recall. | `app/features/research/research.controller.mjs`, Venice providers. | Optional stage controlled by `--expand-queries`; add rate-limit guard.
| **Hybrid Search** | Blend dense (vector) and sparse (BM25) retrieval. | `app/infrastructure/search` adapters, retrieval service fusion logic. | Introduce weighting config; requires vector store integration.
| **Multi-Query Retrieval** | Launch multiple diversified queries per user prompt. | Orchestrated in research engine; dedupe in result aggregator. | Pair with query expansion; add telemetry on query count vs. latency.
| **Hypothetical Document Embeddings (HyDE)** | Use generated answer hypotheses for embedding-based search. | Venice LLM adapter, hybrid search branch. | Wrap in feature flag; ensure hypothesis text doesn’t leak to output without verification.
| **Recursive Retrieval** | Iteratively refine queries based on previous results. | Controller-level loop with abort support. | Needs timeout budget; add `AbortSignal` propagation tests.
| **Graph-Based Retrieval** | Traverse knowledge graph of entities/relations. | New graph index adapter under `app/infrastructure/search/graph`. | Requires schema migration; stage for long-term milestone.
| **Sentence Window Retrieval** | Return sentences surrounding hits for richer context. | Chunk fetcher; requires sentence offset metadata. | Combine with sliding window defaults; ensure citations carry through.
| **Auto-Merging Retrieval** | Merge overlapping or adjacent chunks into cohesive passages. | Post-processing utility in `utils/`. | Run after retrieval but before ranking; maintain canonical citation IDs.

## 3. Ranking & Reranking

| Capability | Primary Goal | Integration Points | Notes & Dependencies |
| --- | --- | --- | --- |
| **Reranking Models** | Re-score top-N candidates with stronger models. | `app/features/research/rerank.service.mjs` (new). | Configurable top-K; reuse telemetry pipelines.
| **Cross-Encoder Rescoring** | Apply BERT/LLM cross-encoders for passage-level accuracy. | `app/infrastructure/ai` adapters. | Share interface with rerank service; enforce latency caps.
| **MMR (Maximal Marginal Relevance)** | Balance relevance with diversity in final selection. | `utils/mmr.mjs` (new). | Provide λ param in preferences; unit tests for edge cases.
| **Negative Sampling** | Gather non-relevant examples to improve models. | Ingestion analytics, offline training pipeline. | Annotate negatives in memory store; export for fine-tuning jobs.
| **Reranking Models (LLM-based)** | Use Venice or other LLMs for final scoring. | Same as above with streaming support. | Ensure cost tracking telemetry.

## 4. Context Assembly & Delivery

| Capability | Primary Goal | Integration Points | Notes & Dependencies |
| --- | --- | --- | --- |
| **Context Window Packing** | Fill LLM prompts efficiently while respecting token budgets. | Prompt builder utilities. | Add packing heuristics tuned per model; expose budgets in config.
| **Lost in the Middle Mitigation** | Reorder or duplicate key facts to avoid mid-context drop-off. | Prompt assembly step. | Consider summary preamble and closing recap with citations.
| **Contextual Compression** | Summarize passages to essential facts before prompting. | Venice summarizer adapter, `app/utils/context-compressor.mjs`. | Must preserve citation anchors; test against hallucination guardrails.
| **Temporal Context Decay** | Downweight stale data during packing. | Scoring modifiers using metadata timestamps. | Configurable half-life; test for recent vs. historical queries.
| **Citation Tracking Chunks** | Ensure every snippet has durable citation IDs. | Chunk schema, prompt formatter. | Update markdown renderer and tests (`research-telemetry`).

## 5. Evaluation & Governance

| Capability | Primary Goal | Integration Points | Notes & Dependencies |
| --- | --- | --- | --- |
| **Context Ablation Testing** | Measure answer sensitivity to specific context pieces. | New test harness in `tests/research-ablation.test.mjs`. | Useful for regression; optional CLI diagnostic mode.
| **Adaptive Retrieval** | Dynamically choose strategy based on query intent & constraints. | High-level orchestrator in controller with heuristics/ML. | Requires telemetry feedback loop; gate behind feature flag.

---

## Implementation Guardrails

1. **Contract First** – Each module begins with a docblock covering inputs, outputs, error modes, and performance budgets. Update corresponding Vitest suites in `/tests` or `/app/tests`.
2. **Config & Surfaces** – Every new capability must be configurable via both CLI (`app/commands/*.cli.mjs`) and web UI (`app/public/*`). Defaults belong in `app/config`.
3. **Telemetry** – Emit structured logs for major decision points (query expansion executed, rerank duration, compression ratio). Route through existing logging adapters.
4. **Testing Strategy** – Provide happy path + boundary + failure-mode coverage. Add smoke tests for CLI flags when behavior changes.
5. **Safety** – Preserve citation fidelity and guardrails against hallucinations. Highlight cost/latency trade-offs in documentation and telemetry.

Use this roadmap to prioritise incremental work. Start with low-risk ingestion aids (sliding windows, metadata), then layer hybrid search and reranking, and reserve graph/adaptive retrieval for dedicated cycles once telemetry establishes the baseline.
