<!--
Why: Capture operational risks, monitoring, and guardrails for safe delivery.
What: Risk register, telemetry operations, content output extensions, and safety mandates.
How: Preserve canonical ops and guardrail content in one file.
Status: active
Last Updated: 2026-02-02
-->

# Operations, Risks, and Guardrails

## 38) Risks & Mitigations
- WebSocket drift → schema contracts + tests.
- Bundle bloat → analyzer + lazy skins.
- Accessibility regression → weekly axe audits.
- Operator confusion → migration guide + parity matrix.
- Telemetry leakage → opt-out + event minimization.
- GPU cost spikes → scale-to-zero + idle shutdown.

## 38.1) Monitoring, Alerts, and Telemetry Operations

**Metrics (baseline)**
- `sync.events_published`, `sync.events_processed`, `sync.latency`, `sync.conflicts_detected`.
- `memory.faiss_size_mb`, `memory.missions.active`, `memory.missions.archived`, `memory.operations{op}`.
- `agent.execution.duration_ms`, `agent.tool.invocations{tool}`, `agent.tokens.used{model}`.

**Alert thresholds**
- Conflict rate >10/min, sync lag >500ms, memory growth >1 GB.
- Mission failure rate >20%, event queue depth >1000, FAISS latency >100ms.
- Token budget exceeded 3x in 1 hour.

**Alert definitions**
- High conflict rate → investigate concurrent editing patterns.
- Sync lag >500ms → check WebSocket health.
- Memory growth >1 GB → trigger consolidation.
- Event queue depth >1000 → review subscriber backpressure.

**Monitoring surfaces**
- Event stream viewer, mission timeline with step durations, memory growth trends.
- Agent performance heatmap (tool usage × success rate), API quota gauge.

**Tool orchestration**
- **Search abstraction**: unified interface for web search, academic papers, and code repos with rate limiting, retries, and provider-normalized results.
- **Crawler integration**: structured extraction from HTML/markdown with content cleaning and metadata capture.
- **RAG retrieval**: vector store queries with similarity thresholds and ranked result sets.

**Telemetry doctrine (derived)**
- Default to minimal event set; no content payloads.
- Explicit opt-out flag for all deployments.
- Log outbound telemetry payloads locally for verification.

## 38.1.1) Observability Format (Logs)

**Structured logs**
- `{ level, module, correlationId, timestamp, ...context }` with sensitive fields redacted.
- HTML session transcripts saved per run for audit/replay.

## 38.4) Content Outputs & Multimodal Extensions

**Export formats**
- Markdown with frontmatter, HTML with embedded styles.
- Slides (markdown → template → PDF/HTML).
- Audio scripts with TTS timestamps.

**Multimodal**
- TTS endpoint accepts section text + voice config; supports SSML.
- Slide assembly maps sections to templates; render via headless browser or PDF engine.

## 38.4.1) Post-Processing Workflows

**Rich text editor**
- Block-based editing with AI actions (improve, shorten, expand, rephrase) and markdown source view.

**Export set**
- Markdown, HTML, slides, and audio scripts with timestamps.

## 38.5) Roadmap to Full Vision (2026+)

**Phase 1 (Now)**
- GUI modernization + orchestration; telemetry deck.

**Phase 2**
- Knowledge + tools: MCP registry, vector DB integration, RAG.

**Phase 3**
- Computer environment: file navigator, shell process management, code sandboxing.

**Phase 4**
- Extensibility: plugins, themes, custom agents, public integration API.

**Phase 5+**
- Fractal agent composition, multi-agent debates, adaptive memory.

## 39) Guardrails & Safety

- Decline harmful requests (malware, self-harm, extremist content, copyrighted media, lyrics).
- Require explicit consent for risky operations (shell execution, code generation).
- Enforce rate limits and resource bounds to prevent runaway execution.
- Log decisions and telemetry without leaking secrets.
