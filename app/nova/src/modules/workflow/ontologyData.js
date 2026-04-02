/* eslint-disable no-dupe-keys */
// Semantic Logic AI Workflow Builder — Ontology Definitions (deduplicated, canonical)
// ===== Helpers =====
export const getNodesByCluster = (clusterCode) =>
  Object.entries(NODE_TYPES)
    .filter(([, t]) => t.cluster === clusterCode)
    .map(([code, t]) => ({ code, ...t }));

export const getClusterSummary = () =>
  Object.entries(ONTOLOGY_CLUSTERS).map(([code, c]) => ({
    code,
    name: c.name,
    color: CLUSTER_COLORS[code],
    nodeCount: getNodesByCluster(code).length
  }));
  
// ===== Clusters =====
export const ONTOLOGY_CLUSTERS = {
  PROP: { name: 'Proposition', icon: '📝', description: 'Basic truth assertions' },
  INQ:  { name: 'Inquiry', icon: '❓', description: 'Information seeking' },
  HEM:  { name: 'Hypothesis/Evidence/Method', icon: '🔬', description: 'Scientific method' },
  RSN:  { name: 'Reasoning', icon: '🧠', description: 'Logic operations' },
  EVL:  { name: 'Evaluation Gates', icon: '✅', description: 'Quality gates' },
  MOD:  { name: 'Modal & Mental-State', icon: '💭', description: 'Logical modalities' },
  SPA:  { name: 'Speech-Act Markers', icon: '💬', description: 'Communication intents' },
  DSC:  { name: 'Discourse Meta', icon: '📚', description: 'Discourse management' },
  CTL:  { name: 'Control & Meta Engines', icon: '⚙️', description: 'Flow control' },
  ERR:  { name: 'Error/Exception', icon: '⚠️', description: 'Error handling' },
  CRT:  { name: 'Creative Operations', icon: '🎨', description: 'Creative processes' },
  MTH:  { name: 'Mathematical Reasoning', icon: '📐', description: 'Mathematical logic' },
  COG:  { name: 'Cognitive Mechanics', icon: '🧩', description: 'Cognitive processes' },
  MND:  { name: 'Mind Constructs', icon: '🧘', description: 'Mental constructs' },
  NCL:  { name: 'Non-Classical Logic', icon: '🔀', description: 'Alternative logic systems' },
  DYN:  { name: 'Dynamic Semantics', icon: '⚡', description: 'Dynamic meaning' },
  UTIL: { name: 'Utility', icon: '🛠️', description: 'Utility nodes (blank, metadata)' },
  CODE: { name: 'Coding', icon: '💻', description: 'Languages and paradigms' },
  ARG:  { name: 'Argumentation', icon: '🗣️', description: 'Argument structure and rhetoric' },
  CRY:  { name: 'Crypto/Web3', icon: '🪙', description: 'Wallets, tokens, DEX, lending, bridges, oracles' },
  BIO:  { name: 'Bioinformatics', icon: '🧬', description: 'Sequencing data, analysis, formats' },
  SYN:  { name: 'Synthetic Biology', icon: '🧫', description: 'Genetic parts, circuits, SBOL' },
  EEE:  { name: 'Electronics/PCB', icon: '🔌', description: 'Schematics, layout, fabrication' },
  FAB:  { name: 'Digital Fabrication', icon: '🛠️', description: '3D printing, CNC, CAM' },
  PROP: { name: 'Proposition', icon: '📝', description: 'Basic truth assertions' },
  INQ:  { name: 'Inquiry', icon: '❓', description: 'Information seeking' },
  HEM:  { name: 'Hypothesis/Evidence/Method', icon: '🔬', description: 'Scientific method' },
  RSN:  { name: 'Reasoning', icon: '🧠', description: 'Logic operations' },
  EVL:  { name: 'Evaluation Gates', icon: '✅', description: 'Quality gates' },
  MOD:  { name: 'Modal & Mental-State', icon: '💭', description: 'Logical modalities' },
  SPA:  { name: 'Speech-Act Markers', icon: '💬', description: 'Communication intents' },
  DSC:  { name: 'Discourse Meta', icon: '📚', description: 'Discourse management' },
  CTL:  { name: 'Control & Meta Engines', icon: '⚙️', description: 'Flow control' },
  ERR:  { name: 'Error/Exception', icon: '⚠️', description: 'Error handling' },
  CRT:  { name: 'Creative Operations', icon: '🎨', description: 'Creative processes' },
  MTH:  { name: 'Mathematical Reasoning', icon: '📐', description: 'Mathematical logic' },
  COG:  { name: 'Cognitive Mechanics', icon: '🧩', description: 'Cognitive processes' },
  MND:  { name: 'Mind Constructs', icon: '🧘', description: 'Mental constructs' },
  NCL:  { name: 'Non-Classical Logic', icon: '🔀', description: 'Alternative logic systems' },
  DYN:  { name: 'Dynamic Semantics', icon: '⚡', description: 'Dynamic meaning' },
  UTIL: { name: 'Utility', icon: '🛠️', description: 'Utility nodes (blank, metadata)' },
  CODE: { name: 'Coding', icon: '💻', description: 'Languages and paradigms' },
  ARG:  { name: 'Argumentation', icon: '🗣️', description: 'Argument structure and rhetoric' },
  CRY:  { name: 'Crypto/Web3', icon: '🪙', description: 'Wallets, tokens, DEX, lending, bridges, oracles' },
  BIO:  { name: 'Bioinformatics', icon: '🧬', description: 'Sequencing data, analysis, formats' },
  SYN:  { name: 'Synthetic Biology', icon: '🧫', description: 'Genetic parts, circuits, SBOL' },
  EEE:  { name: 'Electronics/PCB', icon: '🔌', description: 'Schematics, layout, fabrication' },
  FAB:  { name: 'Digital Fabrication', icon: '🛠️', description: '3D printing, CNC, CAM' },
  ELE:  { name: 'Electronics & Circuits', icon: '🔌', description: 'Electronic design, simulation, components' },
  PCBX: { name: 'PCB Design & Manufacturing', icon: '🧯', description: 'Board rules, fabrication, assembly' },
  MFL:  { name: 'Microfluidics', icon: '🧫', description: 'Micro-scale fluid handling and lab-on-chip' },
  LBA:  { name: 'Lab Automation', icon: '🤖', description: 'Automated experimentation, scheduling, data capture' },
  MAT:  { name: 'Materials Science', icon: '🧱', description: 'Composition, processing, structure, properties' },
  OPT:  { name: 'Optics & Photonics', icon: '🔦', description: 'Sources, optics, detectors, photonics' },
  ROB:  { name: 'Robotics & Mechatronics', icon: '🦾', description: 'Mechanisms, actuators, kinematics, integration' },
  CTR:  { name: 'Control Systems', icon: '🎛️', description: 'Feedback, observers, and controllers' },
  DSP:  { name: 'Signal Processing', icon: '📡', description: 'Acquisition, filtering, transforms, features' },
  RF:   { name: 'RF & Microwave', icon: '📶', description: 'High-frequency design, propagation, matching' },
  PWR:  { name: 'Power Electronics', icon: '🔋', description: 'Conversion topologies, magnetics, protection' },
  SEM:  { name: 'Semiconductor Process', icon: '⚗️', description: 'FEOL/BEOL fabrication steps and modules' },
  CHE:  { name: 'Chemistry & Wet Lab', icon: '🧪', description: 'Reagents, reactions, kinetics, safety' },
  MTR:  { name: 'Metrology & Calibration', icon: '📏', description: 'Measurement, traceability, uncertainty' },
  NDT:  { name: 'Nondestructive Testing', icon: '🛰️', description: 'Inspection without damage for QA' },
  FOR:  { name: 'Formal Verification & Assurance', icon: '✔️', description: 'Mathematical correctness proofs for systems' },
  RLY:  { name: 'Reliability & Safety Engineering', icon: '🛡️', description: 'Hazard analysis and reliability modeling' },
  HFE:  { name: 'Human Factors & HCI', icon: '🧍‍♂️', description: 'Usability, ergonomics, and accessibility' },
  ORX:  { name: 'Operations Research & Optimization', icon: '📈', description: 'Optimization models and decision support' },
  ITY:  { name: 'Information Theory & Coding', icon: '🧮', description: 'Entropy, capacity, and coding schemes' },
  NET:  { name: 'Networks & Graphs', icon: '🕸️', description: 'Graph structures, metrics, and algorithms' },
  SIM:  { name: 'Modeling & Simulation', icon: '🎛️', description: 'Computational models and simulators' },
  STA:  { name: 'Statistics & DOE', icon: '📊', description: 'Inference, testing, and experimental design' },
  EMB:  { name: 'Embedded & Real-Time Systems', icon: '⏱️', description: 'Firmware, RTOS, and safety-critical stacks' },
  OBS:  { name: 'Observability & Telemetry', icon: '🔭', description: 'Logs, metrics, traces, and SLOs' },
  GEO:  { name: 'Geospatial & Remote Sensing', icon: '🗺️', description: 'Spatial data, projections, and sensors' },
  AIM:  { name: 'AI & ML Core', icon: '🧠', description: 'Models, tasks, datasets, and pipelines' },
  LLM:  { name: 'Large Language Models', icon: '📜', description: 'Foundations, prompting, and language tooling' },
  AGT:  { name: 'Agents & Personas', icon: '🤖', description: 'Agent architectures, roles, memory, and tools' },
  RAG:  { name: 'Retrieval-Augmented Generation', icon: '🧷', description: 'Indexing, retrieval, fusion, and grounding' },
  MLO:  { name: 'MLOps Lifecycle', icon: '🛠️', description: 'Data/Model versioning, CI/CD, deployment, monitoring' },
  DSE:  { name: 'Data & Feature Engineering', icon: '🧱', description: 'Datasets, labeling, features, quality, governance' },
  EVA:  { name: 'Evaluation & Benchmarking', icon: '📊', description: 'Metrics, test sets, protocols, red teaming for AI' },
  SAF:  { name: 'Safety & Alignment', icon: '🛡️', description: 'Policy, alignment methods, risk, governance' },
  INT:  { name: 'Interpretability', icon: '🔎', description: 'Attribution, concept analysis, circuit-level insights' },
  OPTA: { name: 'Optimization & Training', icon: '⚙️', description: 'Objectives, schedulers, finetuning and adapters' },
  INF:  { name: 'Inference & Serving', icon: '🚀', description: 'Runtimes, scaling, caching, batching' },
  KGE:  { name: 'Knowledge Graphs & Ontologies', icon: '🕸️', description: 'Graphs, schemas, reasoning over structured knowledge' },
  MM:   { name: 'Multimodal AI', icon: '🎛️', description: 'Vision, audio, speech, 3D, and cross-modal fusion' },
  RL:   { name: 'Reinforcement Learning', icon: '🎯', description: 'Agents, envs, policies, offline/online RL' },
  GEN:  { name: 'Generative Models', icon: '✨', description: 'Diffusion, VAEs, flows, token/image/audio generation' },
  PRIV: { name: 'Privacy & Security in ML', icon: '🔐', description: 'DP, federated, secure training/inference' },
  ETH:  { name: 'AI Ethics & Governance', icon: '⚖️', description: 'Principles, compliance, impact, auditing' },
  TOK:  { name: 'Tokenization & Text Processing', icon: '🔤', description: 'Segmentation, vocabularies, normalization' },
  PROP: { name: 'Proposition', icon: '📝', description: 'Basic truth assertions' },
  INQ:  { name: 'Inquiry', icon: '❓', description: 'Information seeking' },
  HEM:  { name: 'Hypothesis/Evidence/Method', icon: '🔬', description: 'Scientific method' },
  RSN:  { name: 'Reasoning', icon: '🧠', description: 'Logic operations' },
  EVL:  { name: 'Evaluation Gates', icon: '✅', description: 'Quality gates' },
  MOD:  { name: 'Modal & Mental-State', icon: '💭', description: 'Logical modalities' },
  SPA:  { name: 'Speech-Act Markers', icon: '💬', description: 'Communication intents' },
  DSC:  { name: 'Discourse Meta', icon: '📚', description: 'Discourse management' },
  CTL:  { name: 'Control & Meta Engines', icon: '⚙️', description: 'Flow control' },
  ERR:  { name: 'Error/Exception', icon: '⚠️', description: 'Error handling' },
  CRT:  { name: 'Creative Operations', icon: '🎨', description: 'Creative processes' },
  MTH:  { name: 'Mathematical Reasoning', icon: '📐', description: 'Mathematical logic' },
  COG:  { name: 'Cognitive Mechanics', icon: '🧩', description: 'Cognitive processes' },
  MND:  { name: 'Mind Constructs', icon: '🧘', description: 'Mental constructs' },
  NCL:  { name: 'Non-Classical Logic', icon: '🔀', description: 'Alternative logic systems' },
  DYN:  { name: 'Dynamic Semantics', icon: '⚡', description: 'Dynamic meaning' },
  UTIL: { name: 'Utility', icon: '🛠️', description: 'Utility nodes (blank, metadata)' },
  CODE: { name: 'Coding', icon: '💻', description: 'Languages and paradigms' },
  ARG:  { name: 'Argumentation', icon: '🗣️', description: 'Argument structure and rhetoric' },
  CRY:  { name: 'Crypto/Web3', icon: '🪙', description: 'Wallets, tokens, DEX, lending, bridges, oracles' },
  BIO:  { name: 'Bioinformatics', icon: '🧬', description: 'Sequencing data, analysis, formats' },
  SYN:  { name: 'Synthetic Biology', icon: '🧫', description: 'Genetic parts, circuits, SBOL' },
  EEE:  { name: 'Electronics/PCB', icon: '🔌', description: 'Schematics, layout, fabrication' },
  FAB:  { name: 'Digital Fabrication', icon: '🛠️', description: '3D printing, CNC, CAM' },
  PROP: { name: 'Proposition', icon: '📝', description: 'Basic truth assertions' },
  INQ:  { name: 'Inquiry', icon: '❓', description: 'Information seeking' },
  HEM:  { name: 'Hypothesis/Evidence/Method', icon: '🔬', description: 'Scientific method' },
  RSN:  { name: 'Reasoning', icon: '🧠', description: 'Logic operations' },
  EVL:  { name: 'Evaluation Gates', icon: '✅', description: 'Quality gates' },
  MOD:  { name: 'Modal & Mental-State', icon: '💭', description: 'Logical modalities' },
  SPA:  { name: 'Speech-Act Markers', icon: '💬', description: 'Communication intents' },
  DSC:  { name: 'Discourse Meta', icon: '📚', description: 'Discourse management' },
  CTL:  { name: 'Control & Meta Engines', icon: '⚙️', description: 'Flow control' },
  ERR:  { name: 'Error/Exception', icon: '⚠️', description: 'Error handling' },
  CRT:  { name: 'Creative Operations', icon: '🎨', description: 'Creative processes' },
  MTH:  { name: 'Mathematical Reasoning', icon: '📐', description: 'Mathematical logic' },
  COG:  { name: 'Cognitive Mechanics', icon: '🧩', description: 'Cognitive processes' },
  MND:  { name: 'Mind Constructs', icon: '🧘', description: 'Mental constructs' },
  NCL:  { name: 'Non-Classical Logic', icon: '🔀', description: 'Alternative logic systems' },
  DYN:  { name: 'Dynamic Semantics', icon: '⚡', description: 'Dynamic meaning' },
  UTIL: { name: 'Utility', icon: '🛠️', description: 'Utility nodes (blank, metadata)' },
  CODE: { name: 'Coding', icon: '💻', description: 'Languages and paradigms' },
  ARG:  { name: 'Argumentation', icon: '🗣️', description: 'Argument structure and rhetoric' },
  CRY:  { name: 'Crypto/Web3', icon: '🪙', description: 'Wallets, tokens, DEX, lending, bridges, oracles' },
  BIO:  { name: 'Bioinformatics', icon: '🧬', description: 'Sequencing data, analysis, formats' },
  SYN:  { name: 'Synthetic Biology', icon: '🧫', description: 'Genetic parts, circuits, SBOL' },
  EEE:  { name: 'Electronics/PCB', icon: '🔌', description: 'Schematics, layout, fabrication' },
  FAB:  { name: 'Digital Fabrication', icon: '🛠️', description: '3D printing, CNC, CAM' },
  ELE:  { name: 'Electronics & Circuits', icon: '🔌', description: 'Electronic design, simulation, components' },
  PCBX: { name: 'PCB Design & Manufacturing', icon: '🧯', description: 'Board rules, fabrication, assembly' },
  MFL:  { name: 'Microfluidics', icon: '🧫', description: 'Micro-scale fluid handling and lab-on-chip' },
  LBA:  { name: 'Lab Automation', icon: '🤖', description: 'Automated experimentation, scheduling, data capture' },
  MAT:  { name: 'Materials Science', icon: '🧱', description: 'Composition, processing, structure, properties' },
  OPT:  { name: 'Optics & Photonics', icon: '🔦', description: 'Sources, optics, detectors, photonics' },
  ROB:  { name: 'Robotics & Mechatronics', icon: '🦾', description: 'Mechanisms, actuators, kinematics, integration' },
  CTR:  { name: 'Control Systems', icon: '🎛️', description: 'Feedback, observers, and controllers' },
  DSP:  { name: 'Signal Processing', icon: '📡', description: 'Acquisition, filtering, transforms, features' },
  RF:   { name: 'RF & Microwave', icon: '📶', description: 'High-frequency design, propagation, matching' },
  PWR:  { name: 'Power Electronics', icon: '🔋', description: 'Conversion topologies, magnetics, protection' },
  SEM:  { name: 'Semiconductor Process', icon: '⚗️', description: 'FEOL/BEOL fabrication steps and modules' },
  CHE:  { name: 'Chemistry & Wet Lab', icon: '🧪', description: 'Reagents, reactions, kinetics, safety' },
  MTR:  { name: 'Metrology & Calibration', icon: '📏', description: 'Measurement, traceability, uncertainty' },
  NDT:  { name: 'Nondestructive Testing', icon: '🛰️', description: 'Inspection without damage for QA' },
  FOR:  { name: 'Formal Verification & Assurance', icon: '✔️', description: 'Mathematical correctness proofs for systems' },
  RLY:  { name: 'Reliability & Safety Engineering', icon: '🛡️', description: 'Hazard analysis and reliability modeling' },
  HFE:  { name: 'Human Factors & HCI', icon: '🧍‍♂️', description: 'Usability, ergonomics, and accessibility' },
  ORX:  { name: 'Operations Research & Optimization', icon: '📈', description: 'Optimization models and decision support' },
  ITY:  { name: 'Information Theory & Coding', icon: '🧮', description: 'Entropy, capacity, and coding schemes' },
  NET:  { name: 'Networks & Graphs', icon: '🕸️', description: 'Graph structures, metrics, and algorithms' },
  SIM:  { name: 'Modeling & Simulation', icon: '🎛️', description: 'Computational models and simulators' },
  STA:  { name: 'Statistics & DOE', icon: '📊', description: 'Inference, testing, and experimental design' },
  EMB:  { name: 'Embedded & Real-Time Systems', icon: '⏱️', description: 'Firmware, RTOS, and safety-critical stacks' },
  OBS:  { name: 'Observability & Telemetry', icon: '🔭', description: 'Logs, metrics, traces, and SLOs' },
  GEO:  { name: 'Geospatial & Remote Sensing', icon: '🗺️', description: 'Spatial data, projections, and sensors' },
  AIM:  { name: 'AI & ML Core', icon: '🧠', description: 'Models, tasks, datasets, and pipelines' },
  LLM:  { name: 'Large Language Models', icon: '📜', description: 'Foundations, prompting, and language tooling' },
  AGT:  { name: 'Agents & Personas', icon: '🤖', description: 'Agent architectures, roles, memory, and tools' },
  RAG:  { name: 'Retrieval-Augmented Generation', icon: '🧷', description: 'Indexing, retrieval, fusion, and grounding' },
  MLO:  { name: 'MLOps Lifecycle', icon: '🛠️', description: 'Data/Model versioning, CI/CD, deployment, monitoring' },
  DSE:  { name: 'Data & Feature Engineering', icon: '🧱', description: 'Datasets, labeling, features, quality, governance' },
  EVA:  { name: 'Evaluation & Benchmarking', icon: '📊', description: 'Metrics, test sets, protocols, red teaming for AI' },
  SAF:  { name: 'Safety & Alignment', icon: '🛡️', description: 'Policy, alignment methods, risk, governance' },
  INT:  { name: 'Interpretability', icon: '🔎', description: 'Attribution, concept analysis, circuit-level insights' },
  OPTA: { name: 'Optimization & Training', icon: '⚙️', description: 'Objectives, schedulers, finetuning and adapters' },
  INF:  { name: 'Inference & Serving', icon: '🚀', description: 'Runtimes, scaling, caching, batching' },
  KGE:  { name: 'Knowledge Graphs & Ontologies', icon: '🕸️', description: 'Graphs, schemas, reasoning over structured knowledge' },
  MM:   { name: 'Multimodal AI', icon: '🎛️', description: 'Vision, audio, speech, 3D, and cross-modal fusion' },
  RL:   { name: 'Reinforcement Learning', icon: '🎯', description: 'Agents, envs, policies, offline/online RL' },
  GEN:  { name: 'Generative Models', icon: '✨', description: 'Diffusion, VAEs, flows, token/image/audio generation' },
  PRIV: { name: 'Privacy & Security in ML', icon: '🔐', description: 'DP, federated, secure training/inference' },
  ETH:  { name: 'AI Ethics & Governance', icon: '⚖️', description: 'Principles, compliance, impact, auditing' },
  TOK:  { name: 'Tokenization & Text Processing', icon: '🔤', description: 'Segmentation, vocabularies, normalization' },
};



// ===== Colors =====
export const CLUSTER_COLORS = {
  // Core clusters
  PROP: '#3B82F6',
  INQ:  '#8B5CF6',
  HEM:  '#10B981',
  RSN:  '#F59E0B',
  EVL:  '#EF4444',
  MOD:  '#6366F1',
  SPA:  '#EC4899',
  DSC:  '#84CC16',
  CTL:  '#06B6D4',
  ERR:  '#DC2626',
  CRT:  '#F97316',
  MTH:  '#7C3AED',
  COG:  '#059669',
  MND:  '#DB2777',
  NCL:  '#0891B2',
  DYN:  '#65A30D',
  UTIL: '#64748B',
  CODE: '#14B8A6',
  ARG:  '#EAB308',
  CRY:  '#0EA5E9',
  BIO:  '#22C55E',
  SYN:  '#0EA5E9',
  EEE:  '#F59E0B',
  FAB:  '#6B7280',

  // Engineering/science additions
  ELE:  '#F59E0B',
  PCBX: '#3F3F46',
  MFL:  '#16A34A',
  LBA:  '#0EA5A8',
  MAT:  '#CA8A04',
  OPT:  '#1D4ED8',
  ROB:  '#9333EA',
  CTR:  '#0284C7',
  DSP:  '#0EA5E9',
  RF:   '#7C3AED',
  PWR:  '#DC2626',
  SEM:  '#EA580C',
  CHE:  '#A855F7',
  MTR:  '#059669',
  NDT:  '#4F46E5',
  SEC:  '#991B1B',
  SYS:  '#0B7285',
  GMT:  '#6D28D9',
  TRN:  '#15803D',

  // Non-AI domain additions
  FOR: '#0F766E',
  RLY: '#7C3AED',
  HFE: '#2563EB',
  ORX: '#4F46E5',
  ITY: '#BE185D',
  NET: '#0EA5E9',
  SIM: '#0891B2',
  STA: '#22C55E',
  EMB: '#EF4444',
  OBS: '#A855F7',
  GEO: '#16A34A',

  // AI/ML clusters
  AIM: '#2563EB',
  LLM: '#9333EA',
  AGT: '#10B981',
  RAG: '#F59E0B',
  MLO: '#0EA5E9',
  DSE: '#C2410C',
  EVA: '#22C55E',
  SAF: '#EF4444',
  INT: '#7C3AED',
  OPTA:'#4B5563',
  INF: '#F97316',
  KGE: '#06B6D4',
  MM:  '#DB2777',
  RL:  '#84CC16',
  GEN: '#EAB308',
  PRIV:'#111827',
  ETH: '#6B7280',
  TOK: '#3B82F6'
};

export const NODE_TYPES = {

  // Crypto/Web3
  'CRY-WALLET':   { label: 'Wallet', icon: '👛', tags: ['crypto','account'], description: 'User or system wallet/account. Manages keys and on-chain actions.', cluster: 'CRY' },
  'CRY-TOKEN':    { label: 'Token', icon: '🪙', tags: ['crypto','asset'], description: 'Fungible or non-fungible asset reference for balances and I/O.', cluster: 'CRY' },
  'CRY-DEX-SWAP': { label: 'DEX Swap', icon: '🔄', tags: ['dex','swap'], description: 'Swap tokens via DEX. Params: pool, fee, slippage.', cluster: 'CRY' },
  'CRY-LEND':     { label: 'Lend/Deposit', icon: '🏦', tags: ['lending','deposit'], description: 'Deposit collateral into a lending protocol or vault.', cluster: 'CRY' },
  'CRY-BORROW':   { label: 'Borrow', icon: '📉', tags: ['lending','borrow'], description: 'Borrow against collateral. Params: LTV, thresholds.', cluster: 'CRY' },
  'CRY-RISK':     { label: 'Risk Guard', icon: '🛡️', tags: ['risk','health'], description: 'Monitor health factor and route loop/exit by thresholds.', cluster: 'CRY' },
  'CRY-ORACLE':   { label: 'Price Oracle', icon: '📈', tags: ['oracle','price'], description: 'Price data for simulation and validation.', cluster: 'CRY' },
  'CRY-BRIDGE':   { label: 'Bridge', icon: '🌉', tags: ['bridge','chain'], description: 'Cross-chain transfer. Params: source, destination, bridge.', cluster: 'CRY' },
  'CRY-VAULT':    { label: 'Vault', icon: '🗄️', tags: ['vault','strategy'], description: 'Aggregate deposits with a yield strategy.', cluster: 'CRY' },
  'CRY-STRAT':    { label: 'Strategy', icon: '🧭', tags: ['yield','automation'], description: 'Multi-step automated plan (e.g., leverage loop).', cluster: 'CRY' },

  // Speech Acts
  'SPA-REQ':  { label: 'Request', icon: '🙏', tags: ['speech-act','request','directive'], description: 'Ask for action or information to drive workflow steps.', cluster: 'SPA' },
  'SPA-ACK':  { label: 'Acknowledgment', icon: '👍', tags: ['speech-act','ack'], description: 'Confirm receipt or understanding.', cluster: 'SPA' },
  'SPA-APPR': { label: 'Approval', icon: '✅', tags: ['speech-act','approval'], description: 'Accept or endorse a proposal or result.', cluster: 'SPA' },
  'SPA-DECL': { label: 'Declaration', icon: '📢', tags: ['speech-act','declaration'], description: 'State a formal announcement or change of state.', cluster: 'SPA' },
  'SPA-REF':  { label: 'Refusal', icon: '🚫', tags: ['speech-act','refusal'], description: 'Reject a request or proposal.', cluster: 'SPA' },
  'SPA-AST':  { label: 'Assertion', icon: '💬', tags: ['constative'], description: 'Claim truth of a statement.', cluster: 'SPA' },
  'SPA-CMD':  { label: 'Command', icon: '📢', tags: ['imperative'], description: 'Order an action.', cluster: 'SPA' },
  'SPA-ADV':  { label: 'Advice', icon: '💡', tags: ['directive'], description: 'Recommend a course of action.', cluster: 'SPA' },
  'SPA-WRN':  { label: 'Warning', icon: '⚠️', tags: ['directive'], description: 'Alert to hazards or issues.', cluster: 'SPA' },
  'SPA-PRM':  { label: 'Promise', icon: '🤝', tags: ['commissive'], description: 'Commit to a future action.', cluster: 'SPA' },
  'SPA-APO':  { label: 'Apology', icon: '😔', tags: ['expressive'], description: 'Express regret for an action.', cluster: 'SPA' },

  // Discourse Meta
  'DSC-TOPIC': { label: 'Topic', icon: '🗂️', tags: ['discourse','topic'], description: 'Subject/theme of a segment.', cluster: 'DSC' },
  'DSC-FOCUS': { label: 'Focus', icon: '🎯', tags: ['discourse','focus'], description: 'Current point of attention.', cluster: 'DSC' },
  'DSC-SEG':   { label: 'Segment', icon: '✂️', tags: ['discourse','segment'], description: 'Divide discourse into sections.', cluster: 'DSC' },
  'DSC-REF':   { label: 'Reference', icon: '🔗', tags: ['discourse','reference'], description: 'Link to nodes/docs/resources.', cluster: 'DSC' },
  'DSC-ANN':   { label: 'Annotation', icon: '📝', tags: ['meta'], description: 'Side note or comment.', cluster: 'DSC' },
  'DSC-REV':   { label: 'Revision', icon: '✏️', tags: ['edit'], description: 'Modify or update prior content.', cluster: 'DSC' },
  'DSC-SUM':   { label: 'Summarization', icon: '📄', tags: ['abbrev'], description: 'Condense content.', cluster: 'DSC' },
  'DSC-CIT':   { label: 'Citation', icon: '📚', tags: ['source'], description: 'Reference external sources.', cluster: 'DSC' },
  'DSC-CAV':   { label: 'Caveat', icon: '⚠️', tags: ['limitation'], description: 'Scope warning or limitation.', cluster: 'DSC' },

  // Control & Meta Engines
  'CTL-START': { label: 'Start', icon: '🚦', tags: ['control','start'], description: 'Entry point.', cluster: 'CTL' },
  'CTL-END':   { label: 'End', icon: '🏁', tags: ['control','end'], description: 'Termination point.', cluster: 'CTL' },
  'CTL-PAUSE': { label: 'Pause', icon: '⏸️', tags: ['control','pause'], description: 'Temporary halt.', cluster: 'CTL' },
  'CTL-RESUME':{ label: 'Resume', icon: '▶️', tags: ['control','resume'], description: 'Continue after pause.', cluster: 'CTL' },
  'CTL-BRN':   { label: 'Branch', icon: '🔀', tags: ['if'], description: 'Conditional fork.', cluster: 'CTL' },
  'CTL-MERGE': { label: 'Merge', icon: '🔀', tags: ['control','merge'], description: 'Join multiple paths.', cluster: 'CTL' },
  'CTL-CND':   { label: 'Condition', icon: '❓', tags: ['guard'], description: 'Boolean gate for execution.', cluster: 'CTL' },
  'CTL-LOP':   { label: 'Loop', icon: '🔄', tags: ['iterate'], description: 'Repeat until condition.', cluster: 'CTL' },
  'CTL-HLT':   { label: 'Halt', icon: '🛑', tags: ['terminal'], description: 'Stop execution.', cluster: 'CTL' },
  'CTL-ABD':   { label: 'AbductionEngine', icon: '🧬', tags: ['generator'], description: 'Generate hypotheses.', cluster: 'CTL' },
  'CTL-HSL':   { label: 'HeuristicSelector', icon: '🧭', tags: ['search'], description: 'Pick best option by heuristics.', cluster: 'CTL' },
  'CTL-CRS':   { label: 'ConflictResolver', icon: '🤝', tags: ['merge'], description: 'Resolve contradictions.', cluster: 'CTL' },
  'CTL-PDX':   { label: 'ParadoxDetector', icon: '🌀', tags: ['selfref'], description: 'Flag paradoxes/self-reference.', cluster: 'CTL' },

  // Errors/Exceptions
  'ERR-EXC': { label: 'Exception', icon: '💥', tags: ['error','exception','runtime'], description: 'Exceptional condition.', cluster: 'ERR' },
  'ERR-REC': { label: 'Recovery', icon: '🛠️', tags: ['error','recovery'], description: 'Steps to recover.', cluster: 'ERR' },
  'ERR-LOG': { label: 'Error Log', icon: '📋', tags: ['error','log'], description: 'Record errors for analysis.', cluster: 'ERR' },
  'ERR-CON': { label: 'Contradiction', icon: '⚠️', tags: ['⊥'], description: 'Logical inconsistency.', cluster: 'ERR' },
  'ERR-FAL': { label: 'Fallacy', icon: '❌', tags: ['invalid'], description: 'Faulty reasoning.', cluster: 'ERR' },

  // Creative Operations
  'CRT-IDEA': { label: 'Idea', icon: '💡', tags: ['creative','idea'], description: 'Creative thought.', cluster: 'CRT' },
  'CRT-GEN':  { label: 'Generate', icon: '✨', tags: ['creative','generate'], description: 'Create alternatives.', cluster: 'CRT' },
  'CRT-MOD':  { label: 'Modify', icon: '🛠️', tags: ['creative','modify'], description: 'Adapt existing content.', cluster: 'CRT' },
  'CRT-COMB': { label: 'Combine', icon: '🔗', tags: ['creative','combine'], description: 'Merge ideas/sources.', cluster: 'CRT' },
  'CRT-INS':  { label: 'Insight', icon: '💡', tags: ['aha'], description: 'New perspective.', cluster: 'CRT' },
  'CRT-DIV':  { label: 'DivergentThought', icon: '🎨', tags: ['brainstorm'], description: 'Expand idea space.', cluster: 'CRT' },
  'CRT-COM':  { label: 'ConceptCombination', icon: '🔗', tags: ['blend'], description: 'Blend concepts.', cluster: 'CRT' },

  // Math Reasoning
  'MTH-EXPR':    { label: 'Expression', icon: '🧮', tags: ['math','expression'], description: 'Formula or computation.', cluster: 'MTH' },
  'MTH-EQ':      { label: 'Equation', icon: '🟰', tags: ['math','equation'], description: 'Relation between variables.', cluster: 'MTH' },
  'MTH-THM':     { label: 'Theorem', icon: '📐', tags: ['math','theorem'], description: 'Proven result.', cluster: 'MTH' },
  'MTH-PRF':     { label: 'Proof', icon: '📝', tags: ['math','proof'], description: 'Demonstrate validity.', cluster: 'MTH' },
  'MTH-PRF-STR': { label: 'ProofStrategy', icon: '📐', tags: ['meta-proof'], description: 'Method to derive theorem.', cluster: 'MTH' },
  'MTH-CON':     { label: 'Conjecture', icon: '🤔', tags: ['open'], description: 'Unproven proposition.', cluster: 'MTH' },
  'MTH-UND':     { label: 'UndecidableTag', icon: '❓', tags: ['Gödel'], description: 'Truth value unresolvable.', cluster: 'MTH' },

  // Cognitive Mechanics
  'COG-PLAN': { label: 'Plan', icon: '🗺️', tags: ['cognitive','plan'], description: 'Sequence of actions.', cluster: 'COG' },
  'COG-GOAL': { label: 'Goal', icon: '🎯', tags: ['cognitive','goal'], description: 'Desired end state.', cluster: 'COG' },
  'COG-DEC':  { label: 'Decision', icon: '🗳️', tags: ['cognitive','decision'], description: 'Choice among options.', cluster: 'COG' },
  'COG-EVAL': { label: 'Evaluation', icon: '✅', tags: ['cognitive','evaluation'], description: 'Assess options/outcomes.', cluster: 'COG' },
  'COG-CHN':  { label: 'Chunk', icon: '🧩', tags: ['memory'], description: 'Unit of information.', cluster: 'COG' },
  'COG-SCH':  { label: 'Schema', icon: '🗂️', tags: ['frame'], description: 'Structured prior knowledge.', cluster: 'COG' },
  'COG-CLD':  { label: 'CognitiveLoad', icon: '⚖️', tags: ['resource'], description: 'Working-memory usage.', cluster: 'COG' },
  'COG-PRM':  { label: 'Priming', icon: '🎯', tags: ['bias'], description: 'Prior activation.', cluster: 'COG' },
  'COG-INH':  { label: 'Inhibition', icon: '🚫', tags: ['suppress'], description: 'Filter interference.', cluster: 'COG' },
  'COG-THG':  { label: 'ThresholdGate', icon: '🚪', tags: ['attention'], description: 'Fire if salience ≥ δ.', cluster: 'COG' },
  'COG-FLU':  { label: 'FluidIntelligence', icon: '🌊', tags: ['gf'], description: 'Novel problem solving.', cluster: 'COG' },
  'COG-CRY':  { label: 'CrystallizedProxy', icon: '💎', tags: ['gc'], description: 'Stored knowledge metric.', cluster: 'COG' },

  // Mind Constructs
  'MND-BEL': { label: 'Belief', icon: '🧠', tags: ['mind','belief'], description: 'Held assumption.', cluster: 'MND' },
  'MND-DES': { label: 'Desire', icon: '❤️', tags: ['mind','desire'], description: 'Preference/want.', cluster: 'MND' },
  'MND-INT': { label: 'Intention', icon: '🤔', tags: ['mind','intention'], description: 'Planned action.', cluster: 'MND' },
  'MND-PHF': { label: 'PhenomenalField', icon: '🌟', tags: ['qualia'], description: 'First-person content.', cluster: 'MND' },
  'MND-ACC': { label: 'AccessConsciousness', icon: '🔓', tags: ['reportable'], description: 'Globally available info.', cluster: 'MND' },
  'MND-ZOM': { label: 'ZombieArgument', icon: '🧟', tags: ['philosophy'], description: 'Qualia absence test.', cluster: 'MND' },
  'MND-SUP': { label: 'SupervenienceTag', icon: '🔼', tags: ['dependence'], description: 'Higher-level depends on base.', cluster: 'MND' },
  'MND-EXT': { label: 'ExtendedMind', icon: '🌐', tags: ['4E'], description: 'Mind beyond skull.', cluster: 'MND' },
  'MND-EMB': { label: 'EmbeddedProcess', icon: '🏠', tags: ['situated'], description: 'Cognition in environment.', cluster: 'MND' },

  // Non-Classical Logic
  'NCL-FUZZY': { label: 'Fuzzy Logic', icon: '🌫️', tags: ['non-classical','fuzzy'], description: 'Degrees of truth.', cluster: 'NCL' },
  'NCL-MODAL': { label: 'Modal Logic', icon: '🔮', tags: ['non-classical','modal'], description: 'Necessity/possibility.', cluster: 'NCL' },
  'NCL-INTU':  { label: 'Intuitionistic Logic', icon: '🧘', tags: ['non-classical','intuitionistic'], description: 'No excluded middle.', cluster: 'NCL' },
  'NCL-REL':   { label: 'RelevanceMarker', icon: '🔗', tags: ['R-logic'], description: 'Premise relevance.', cluster: 'NCL' },
  'NCL-LIN':   { label: 'LinearResource', icon: '🔄', tags: ['⊗'], description: 'Consume-once proposition.', cluster: 'NCL' },
  'NCL-MNV':   { label: 'ManyValued', icon: '🎚️', tags: ['Łukasiewicz'], description: '> 2 truth degrees.', cluster: 'NCL' },
  'NCL-QNT':   { label: 'QuantumLogic', icon: '⚛️', tags: ['orthomodular'], description: 'Non-distributive lattice.', cluster: 'NCL' },
  'NCL-REV':   { label: 'BeliefRevision', icon: '🔄', tags: ['AGM'], description: 'Update (K, φ) → K*.', cluster: 'NCL' },
  'NCL-AGM':   { label: 'AGM-Operator', icon: '🔧', tags: ['∘'], description: 'Contraction/revision function.', cluster: 'NCL' },

  // Dynamic Semantics
  'DYN-CNTXT': { label: 'Context', icon: '🌐', tags: ['dynamic','context'], description: 'Situational/semantic context.', cluster: 'DYN' },
  'DYN-UPD':   { label: 'UpdateProcedure', icon: '🔄', tags: ['context'], description: 'Modify discourse state.', cluster: 'DYN' },
  'DYN-CSH':   { label: 'ContextShift', icon: '🔀', tags: ['indexical'], description: 'Change evaluation world.', cluster: 'DYN' },
  'DYN-REF':   { label: 'DiscourseReferent', icon: '🔗', tags: ['DRT'], description: 'Entity slot.', cluster: 'DYN' },
  'DYN-ANA':   { label: 'AnaphoraTag', icon: '↩️', tags: ['coref'], description: 'Pronoun linkage.', cluster: 'DYN' },
  'DYN-CGD':   { label: 'CommonGround', icon: '🤝', tags: ['shared'], description: 'Mutual belief store.', cluster: 'DYN' },
  'DYN-PRS':   { label: 'Presupposition', icon: '📋', tags: ['presup'], description: 'Background truth.', cluster: 'DYN' },

  // Utility
  'UTIL-BLANK': { label: 'Blank Node', icon: '⬜', tags: ['utility'], description: 'Editable placeholder node.', cluster: 'UTIL' },
  'UTIL-META':  { label: 'Metadata Node', icon: '🗂️', tags: ['utility','meta'], description: 'Store author, version, tags.', cluster: 'UTIL' },

  // Coding — paradigms
  'CODE-IMP':    { label: 'Imperative', icon: '📝', tags: ['paradigm','imperative'], description: 'Manipulate state with statements.', cluster: 'CODE' },
  'CODE-OBJ':    { label: 'Object-Oriented', icon: '🧩', tags: ['paradigm','oop'], description: 'Objects with encapsulated state/behavior.', cluster: 'CODE' },
  'CODE-CONC':   { label: 'Concurrent/Parallel', icon: '🔀', tags: ['paradigm','concurrent'], description: 'Multiple computations simultaneously.', cluster: 'CODE' },
  'CODE-ACTOR':  { label: 'Actor Model', icon: '🎭', tags: ['paradigm','actor'], description: 'Actors via message passing.', cluster: 'CODE' },
  'CODE-EVENT':  { label: 'Event-Driven', icon: '⚡', tags: ['paradigm','event'], description: 'Respond to events/signals.', cluster: 'CODE' },
  'CODE-REACT':  { label: 'Reactive', icon: '🔁', tags: ['paradigm','reactive'], description: 'Asynchronous streams and propagation.', cluster: 'CODE' },
  'CODE-DATAFLOW':{ label: 'Dataflow', icon: '🔗', tags: ['paradigm','dataflow'], description: 'Graph of data dependencies.', cluster: 'CODE' },
  'CODE-PIPE':   { label: 'Pipeline/Stream', icon: '🚰', tags: ['paradigm','pipeline'], description: 'Sequential transformations.', cluster: 'CODE' },
  'CODE-DECL':   { label: 'Declarative', icon: '📜', tags: ['paradigm','declarative'], description: 'Specify what, not how.', cluster: 'CODE' },
  'CODE-FUNC':   { label: 'Functional', icon: '🧮', tags: ['paradigm','functional'], description: 'Pure functions and immutability.', cluster: 'CODE' },
  'CODE-LOGIC':  { label: 'Logic', icon: '🔎', tags: ['paradigm','logic'], description: 'Facts and rules to infer.', cluster: 'CODE' },
  'CODE-CONSTR': { label: 'Constraint', icon: '🛑', tags: ['paradigm','constraint'], description: 'Solve via constraints.', cluster: 'CODE' },
  'CODE-RULE':   { label: 'Rule-Based', icon: '📋', tags: ['paradigm','rule'], description: 'If-then rules.', cluster: 'CODE' },
  'CODE-REL':    { label: 'Relational/Query', icon: '🔍', tags: ['paradigm','relational'], description: 'Relations and set ops.', cluster: 'CODE' },
  'CODE-PROB':   { label: 'Probabilistic', icon: '📊', tags: ['paradigm','probabilistic'], description: 'Uncertainty and inference.', cluster: 'CODE' },
  'CODE-DIFF':   { label: 'Differentiable', icon: '🧠', tags: ['paradigm','differentiable'], description: 'Auto-diff for ML/opt.', cluster: 'CODE' },
  'CODE-SYM':    { label: 'Symbolic', icon: '🔣', tags: ['paradigm','symbolic'], description: 'Manipulate symbols/expressions.', cluster: 'CODE' },
  'CODE-META':   { label: 'Metaprogramming', icon: '🛠️', tags: ['paradigm','meta'], description: 'Programs about programs.', cluster: 'CODE' },
  'CODE-GEN':    { label: 'Generic', icon: '🔧', tags: ['paradigm','generic'], description: 'Type-parameterized reuse.', cluster: 'CODE' },
  'CODE-ASPECT': { label: 'Aspect-Oriented', icon: '🎯', tags: ['paradigm','aspect'], description: 'Cross-cutting concerns.', cluster: 'CODE' },
  'CODE-AGENT':  { label: 'Agent-Oriented', icon: '🤖', tags: ['paradigm','agent'], description: 'Autonomous agents.', cluster: 'CODE' },
  'CODE-ARRAY':  { label: 'Array Programming', icon: '🧮', tags: ['paradigm','array'], description: 'Whole-array ops.', cluster: 'CODE' },
  'CODE-DATA':   { label: 'Data-Driven', icon: '📈', tags: ['paradigm','data-driven'], description: 'Data layout and transforms.', cluster: 'CODE' },
  'CODE-AUTO':   { label: 'Automata-Based', icon: '🔄', tags: ['paradigm','automata'], description: 'Explicit state machines.', cluster: 'CODE' },
  'CODE-ATTR':   { label: 'Attribute-Oriented', icon: '🏷️', tags: ['paradigm','attribute'], description: 'Annotations guide behavior.', cluster: 'CODE' },
  'CODE-CONLOG': { label: 'Constraint Logic', icon: '🧩', tags: ['paradigm','constraint-logic'], description: 'Logic + constraints.', cluster: 'CODE' },
  'CODE-CHOREO': { label: 'Choreographic', icon: '🕺', tags: ['paradigm','choreographic'], description: 'Global interactions → local.', cluster: 'CODE' },
  'CODE-EVSRC':  { label: 'Event-Sourcing/CQRS', icon: '📦', tags: ['paradigm','event-sourcing'], description: 'State from events.', cluster: 'CODE' },
  'CODE-VISUAL': { label: 'Visual/Diagrammatic', icon: '🖼️', tags: ['paradigm','visual'], description: 'Graphical composition.', cluster: 'CODE' },
  'CODE-LIT':    { label: 'Literate Programming', icon: '📚', tags: ['paradigm','literate'], description: 'Code with narrative.', cluster: 'CODE' },
  'CODE-DSL':    { label: 'DSL-Oriented', icon: '📝', tags: ['paradigm','dsl'], description: 'Domain-specific languages.', cluster: 'CODE' },

  // Coding — languages
  'CODE-C':        { label: 'C', icon: '💻', tags: ['language','systems'], description: 'Systems programming.', cluster: 'CODE' },
  'CODE-CPP':      { label: 'C++', icon: '💻', tags: ['language','systems'], description: 'C with OO/templates.', cluster: 'CODE' },
  'CODE-JAVA':     { label: 'Java', icon: '☕', tags: ['language','general-purpose'], description: 'JVM language.', cluster: 'CODE' },
  'CODE-PY':       { label: 'Python', icon: '🐍', tags: ['language','general-purpose','data-science'], description: 'High-level, dynamic.', cluster: 'CODE' },
  'CODE-JS':       { label: 'JavaScript', icon: '🟨', tags: ['language','web'], description: 'Web/runtime language.', cluster: 'CODE' },
  'CODE-TS':       { label: 'TypeScript', icon: '🟦', tags: ['language','web'], description: 'Typed JS.', cluster: 'CODE' },
  'CODE-CS':       { label: 'C#', icon: '🎹', tags: ['language','.net'], description: '.NET language.', cluster: 'CODE' },
  'CODE-GO':       { label: 'Go', icon: '🐹', tags: ['language','systems'], description: 'Simplicity and concurrency.', cluster: 'CODE' },
  'CODE-RUST':     { label: 'Rust', icon: '🦀', tags: ['language','systems'], description: 'Memory safety and speed.', cluster: 'CODE' },
  'CODE-SWIFT':    { label: 'Swift', icon: '🦅', tags: ['language','mobile'], description: 'Apple platforms.', cluster: 'CODE' },
  'CODE-KOTLIN':   { label: 'Kotlin', icon: '🤖', tags: ['language','mobile'], description: 'Concise JVM/Android.', cluster: 'CODE' },
  'CODE-PHP':      { label: 'PHP', icon: '🐘', tags: ['language','web'], description: 'Server-side web.', cluster: 'CODE' },
  'CODE-RUBY':     { label: 'Ruby', icon: '💎', tags: ['language','web'], description: 'Dynamic OO.', cluster: 'CODE' },
  'CODE-R':        { label: 'R', icon: '📊', tags: ['language','data-science'], description: 'Stats and plots.', cluster: 'CODE' },
  'CODE-JULIA':    { label: 'Julia', icon: '🔬', tags: ['language','data-science'], description: 'High-perf technical.', cluster: 'CODE' },
  'CODE-MATLAB':   { label: 'MATLAB', icon: '📈', tags: ['language','data-science'], description: 'Numerical computing.', cluster: 'CODE' },
  'CODE-SQL':      { label: 'SQL', icon: '🗄️', tags: ['language','database'], description: 'Relational queries.', cluster: 'CODE' },
  'CODE-BASH':     { label: 'Bash/Shell', icon: '🐚', tags: ['language','scripting'], description: 'CLI automation.', cluster: 'CODE' },
  'CODE-LUA':      { label: 'Lua', icon: '🌙', tags: ['language','scripting'], description: 'Lightweight embeddable.', cluster: 'CODE' },
  'CODE-SOL':      { label: 'Solidity', icon: '🪙', tags: ['language','blockchain'], description: 'Smart contracts.', cluster: 'CODE' },
  'CODE-HASKELL':  { label: 'Haskell', icon: 'λ', tags: ['language','functional'], description: 'Pure FP.', cluster: 'CODE' },
  'CODE-ERLANG':   { label: 'Erlang', icon: '🦉', tags: ['language','functional'], description: 'Concurrent, fault-tolerant.', cluster: 'CODE' },
  'CODE-ELIXIR':   { label: 'Elixir', icon: '💧', tags: ['language','functional'], description: 'Erlang VM, scalable.', cluster: 'CODE' },
  'CODE-OCAML':    { label: 'OCaml', icon: '🐫', tags: ['language','functional'], description: 'FP with OO, inference.', cluster: 'CODE' },
  'CODE-FSHARP':   { label: 'F#', icon: '🎼', tags: ['language','functional'], description: 'Functional-first .NET.', cluster: 'CODE' },
  'CODE-LISP':     { label: 'Lisp', icon: '🧠', tags: ['language','functional','meta'], description: 'Homoiconic macros.', cluster: 'CODE' },
  'CODE-SCALA':    { label: 'Scala', icon: '🦑', tags: ['language','jvm'], description: 'OO + FP on JVM.', cluster: 'CODE' },
  'CODE-GROOVY':   { label: 'Groovy', icon: '🎷', tags: ['language','jvm'], description: 'Dynamic JVM scripting.', cluster: 'CODE' },
  'CODE-CLOJURE':  { label: 'Clojure', icon: '🍃', tags: ['language','jvm'], description: 'Modern Lisp on JVM.', cluster: 'CODE' },
  'CODE-ADA':      { label: 'Ada', icon: '🛡️', tags: ['language','systems'], description: 'Safety-critical.', cluster: 'CODE' },
  'CODE-FORTRAN':  { label: 'Fortran', icon: '📐', tags: ['language','scientific'], description: 'HPC and simulations.', cluster: 'CODE' },
  'CODE-COBOL':    { label: 'COBOL', icon: '🏦', tags: ['language','legacy'], description: 'Enterprise legacy.', cluster: 'CODE' },
  'CODE-ABAP':     { label: 'ABAP', icon: '🏢', tags: ['language','enterprise'], description: 'SAP ERP.', cluster: 'CODE' },
  'CODE-SAS':      { label: 'SAS', icon: '📊', tags: ['language','stats'], description: 'Statistical suite.', cluster: 'CODE' },
  'CODE-HTML':     { label: 'HTML', icon: '🌐', tags: ['language','markup'], description: 'Web markup.', cluster: 'CODE' },
  'CODE-CSS':      { label: 'CSS', icon: '🎨', tags: ['language','markup'], description: 'Web styling.', cluster: 'CODE' },
  'CODE-JSON':     { label: 'JSON', icon: '🗃️', tags: ['language','config'], description: 'Data interchange.', cluster: 'CODE' },
  'CODE-YAML':     { label: 'YAML', icon: '📄', tags: ['language','config'], description: 'Human-friendly config.', cluster: 'CODE' },
  'CODE-XML':      { label: 'XML', icon: '📄', tags: ['language','config'], description: 'Structured data.', cluster: 'CODE' },

  // Argumentation
  'ARG-PRM': { label: 'Premise', icon: '🧩', tags: ['support'], description: 'Supporting reason.', cluster: 'ARG' },
  'ARG-CNC': { label: 'Conclusion', icon: '🏁', tags: ['result'], description: 'Drawn inference.', cluster: 'ARG' },
  'ARG-WRR': { label: 'Warrant', icon: '🔗', tags: ['justification'], description: 'Link premises→conclusion.', cluster: 'ARG' },
  'ARG-BCK': { label: 'Backing', icon: '🛡️', tags: ['foundation'], description: 'Support for warrant.', cluster: 'ARG' },
  'ARG-RBT': { label: 'Rebuttal', icon: '⚔️', tags: ['counter'], description: 'Opposing reason.', cluster: 'ARG' },
  'ARG-QLF': { label: 'Qualifier', icon: '📉', tags: ['modality'], description: 'Degree of certainty.', cluster: 'ARG' },

  // Propositions
  'PROP-STM': { label: 'Statement', icon: '📄', tags: ['atomic'], description: 'Truth-apt sentence.', cluster: 'PROP' },
  'PROP-CLM': { label: 'Claim', icon: '🔔', tags: ['assertive'], description: 'Contestable assertion.', cluster: 'PROP' },
  'PROP-DEF': { label: 'Definition', icon: '📖', tags: ['lexical'], description: 'Meaning of a term.', cluster: 'PROP' },
  'PROP-OBS': { label: 'Observation', icon: '👁️', tags: ['empirical'], description: 'Empirical record.', cluster: 'PROP' },
  'PROP-CNC': { label: 'Concept', icon: '💡', tags: ['abstraction'], description: 'Abstract idea.', cluster: 'PROP' },

  // Inquiry
  'INQ-QRY': { label: 'Query', icon: '🔍', tags: ['interrogative'], description: 'Request specific data.', cluster: 'INQ' },
  'INQ-QST': { label: 'Question', icon: '❓', tags: ['wh','polar'], description: 'Open or closed question.', cluster: 'INQ' },
  'INQ-PRB': { label: 'Problem', icon: '🎯', tags: ['challenge'], description: 'Desired-state mismatch.', cluster: 'INQ' },

  // HEM
  'HEM-HYP': { label: 'Hypothesis', icon: '🔮', tags: ['tentative'], description: 'Testable proposition.', cluster: 'HEM' },
  'HEM-EVD': { label: 'Evidence', icon: '📊', tags: ['support'], description: 'Support/refute claims.', cluster: 'HEM' },
  'HEM-DAT': { label: 'Data', icon: '📈', tags: ['raw'], description: 'Uninterpreted records.', cluster: 'HEM' },
  'HEM-CTX': { label: 'Counterexample', icon: '❌', tags: ['refuter'], description: 'Violates hypothesis.', cluster: 'HEM' },
  'HEM-MTH': { label: 'Method', icon: '🔬', tags: ['procedure'], description: 'High-level approach.', cluster: 'HEM' },
  'HEM-PRC': { label: 'Procedure', icon: '📋', tags: ['stepwise'], description: 'Ordered steps.', cluster: 'HEM' },
  'HEM-ALG': { label: 'Algorithm', icon: '🤖', tags: ['computable'], description: 'Deterministic routine.', cluster: 'HEM' },
  'HEM-PRT': { label: 'Protocol', icon: '📜', tags: ['standard'], description: 'Rules for interaction.', cluster: 'HEM' },

  // Bioinformatics
  'BIO-FASTA': { label: 'FASTA', icon: '📄', tags: ['domain:bio','format','sequence'], description: 'Reference or assembled sequences.', cluster: 'BIO' },
  'BIO-FASTQ': { label: 'FASTQ', icon: '🧪', tags: ['domain:bio','format','raw-reads'], description: 'Raw reads with quality.', cluster: 'BIO' },
  'BIO-SAM':   { label: 'SAM/BAM', icon: '🧷', tags: ['domain:bio','format','alignment'], description: 'Read alignments to reference.', cluster: 'BIO' },
  'BIO-CRAM':  { label: 'CRAM', icon: '🗜️', tags: ['domain:bio','format','alignment','compressed'], description: 'Compressed reference-based alignments.', cluster: 'BIO' },
  'BIO-VCF':   { label: 'VCF', icon: '🧬', tags: ['domain:bio','format','variants'], description: 'Variant calls and genotypes.', cluster: 'BIO' },
  'BIO-GFF3':  { label: 'GFF3/GTF', icon: '🗺️', tags: ['domain:bio','format','annotation'], description: 'Genome feature annotations.', cluster: 'BIO' },
  'BIO-PIPE':  { label: 'NGS Pipeline', icon: '🧫', tags: ['domain:bio','process'], description: 'Raw→QC→Align→Call/Quant→Report.', cluster: 'BIO' },

  // Synthetic Biology
  'SYN-SBOL':    { label: 'SBOL Design', icon: '🧩', tags: ['domain:synbio','standard','design'], description: 'Design exchange standard.', cluster: 'SYN' },
  'SYN-SBOLV':   { label: 'SBOL Visual', icon: '🖼️', tags: ['domain:synbio','glyphs'], description: 'Glyphs for designs.', cluster: 'SYN' },
  'SYN-GPART':   { label: 'Genetic Part', icon: '🧱', tags: ['domain:synbio','promoter','CDS','RBS','terminator'], description: 'Atomic parts for circuits.', cluster: 'SYN' },
  'SYN-GCIR':    { label: 'Genetic Circuit', icon: '🔗', tags: ['domain:synbio','logic'], description: 'Composed parts implement logic.', cluster: 'SYN' },
  'SYN-SBOLAPP': { label: 'SBOL Tool', icon: '🛠️', tags: ['domain:synbio','tooling'], description: 'Design tools using SBOL.', cluster: 'SYN' },

  // Electronics / PCB
  'EEE-SCH':     { label: 'Schematic', icon: '📘', tags: ['domain:pcb','design'], description: 'Logical connectivity.', cluster: 'EEE' },
  'EEE-NET':     { label: 'Netlist', icon: '🧮', tags: ['domain:pcb','intermediate'], description: 'Connectivity list.', cluster: 'EEE' },
  'EEE-BOM':     { label: 'BOM', icon: '📑', tags: ['domain:pcb','supply'], description: 'Bill of materials.', cluster: 'EEE' },
  'EEE-GERBER':  { label: 'Gerber X2', icon: '🗂️', tags: ['domain:pcb','format','fab-fallback'], description: 'Artwork format for fab.', cluster: 'EEE' },
  'EEE-IPC2581': { label: 'IPC-2581', icon: '🧾', tags: ['domain:pcb','format','fab-primary'], description: 'Open manufacturing data.', cluster: 'EEE' },
  'EEE-ODBPP':   { label: 'ODB++', icon: '📦', tags: ['domain:pcb','format'], description: 'Rich manufacturing DB.', cluster: 'EEE' },
  'EEE-PNP':     { label: 'Pick-and-Place', icon: '🤖', tags: ['domain:pcb','assembly'], description: 'Placement coordinates.', cluster: 'EEE' },
  'EEE-STEP':    { label: 'STEP Model', icon: '📐', tags: ['domain:pcb','mechanical'], description: '3D model for MCAD.', cluster: 'EEE' },

  // Digital Fabrication
  'FAB-3MF':   { label: '3MF', icon: '🧱', tags: ['domain:fabrication','format','print-primary'], description: 'Rich 3D print model.', cluster: 'FAB' },
  'FAB-STL':   { label: 'STL', icon: '📦', tags: ['domain:fabrication','format','print-fallback'], description: 'Triangle mesh no metadata.', cluster: 'FAB' },
  'FAB-AMF':   { label: 'AMF', icon: '🧩', tags: ['domain:fabrication','format'], description: 'XML additive format.', cluster: 'FAB' },
  'FAB-GCODE': { label: 'G-code (ISO 6983/RS-274)', icon: '⌨️', tags: ['domain:fabrication','cnc','print'], description: 'Executable toolpaths.', cluster: 'FAB' },
  'FAB-CAM':   { label: 'CAM Toolpath', icon: '🛤️', tags: ['domain:fabrication','intermediate'], description: 'Post-processed paths.', cluster: 'FAB' },
  'FAB-SLICE': { label: 'Slicer Profile', icon: '⚙️', tags: ['domain:fabrication','print-settings'], description: 'Layer/speed/temp settings.', cluster: 'FAB' },


  // Security/system/game/translation
  SEC:  { name: 'Security & Adversarial', icon: '🛡️', description: 'Red teaming, penetration testing, adversarial methods' },
  SYS:  { name: 'Systems Theory', icon: '🔄', description: 'System dynamics, cybernetics, and control theory' },
  GMT:  { name: 'Game Theory', icon: '🎲', description: 'Strategic interactions, equilibrium models, incentives' },
  TRN:  { name: 'Translation & Localization', icon: '🌐', description: 'Cross-language translation, terminology, and QA' },


  // Reasoning
  'RSN-DED': { label: 'Deduction', icon: '➡️', tags: ['validity'], description: 'Necessary conclusions.', cluster: 'RSN' },
  'RSN-IND': { label: 'Induction', icon: '🔄', tags: ['generalise'], description: 'From instances to rules.', cluster: 'RSN' },
  'RSN-ABD': { label: 'Abduction', icon: '🕵️', tags: ['explain'], description: 'Best-fit explanations.', cluster: 'RSN' },
  'RSN-ANL': { label: 'Analogy', icon: '🔗', tags: ['similarity'], description: 'Map similarities.', cluster: 'RSN' },
  'RSN-IRL': { label: 'InferenceRule', icon: '📐', tags: ['schema'], description: 'Pattern for derivations.', cluster: 'RSN' },

  // Modal & Mental-State
  'MOD-REQ': { label: 'Requirement', icon: '📋', tags: ['must'], description: 'Necessary condition.', cluster: 'MOD' },
  'MOD-OPT': { label: 'Option', icon: '⚙️', tags: ['may'], description: 'Permissible alternative.', cluster: 'MOD' },
  'MOD-PRF': { label: 'Preference', icon: '💎', tags: ['better'], description: 'Prioritized choice.', cluster: 'MOD' },
  'MOD-OBJ': { label: 'Objective', icon: '🎯', tags: ['goal'], description: 'Desired outcome.', cluster: 'MOD' },
  'MOD-NEC': { label: 'Necessity', icon: '🔒', tags: ['◻'], description: 'True in all possible worlds.', cluster: 'MOD' },
  'MOD-POS': { label: 'Possibility', icon: '🔓', tags: ['◇'], description: 'True in some world.', cluster: 'MOD' },
  'MOD-OBL': { label: 'Obligation', icon: '⚖️', tags: ['deontic'], description: 'Duty-bound requirement.', cluster: 'MOD' },
  'MOD-PER': { label: 'Permission', icon: '✅', tags: ['deontic'], description: 'Action allowed.', cluster: 'MOD' },
  'MOD-TMP': { label: 'TemporalTag', icon: '⏰', tags: ['time'], description: 'Past/present/future context.', cluster: 'MOD' },
  'MOD-EPI': { label: 'EpistemicTag', icon: '🧠', tags: ['knowledge'], description: 'Certainty/knowledge level.', cluster: 'MOD' },
  'MOD-BEL': { label: 'Belief', icon: '💭', tags: ['mental'], description: 'Agent accepts as true.', cluster: 'MOD' },
  'MOD-DES': { label: 'Desire', icon: '💖', tags: ['mental'], description: 'Agent wants/prefers.', cluster: 'MOD' },
  'MOD-INT': { label: 'Intent', icon: '🎯', tags: ['mental'], description: 'Plan/commitment to act.', cluster: 'MOD' },

  'BIO-SEQ':    { label: 'Sequence', icon: '📜', tags: ['nucleotide','protein'], description: 'Sequence entity.', cluster: 'BIO' },
  'BIO-QC':     { label: 'SeqQC', icon: '✅', tags: ['FastQC','quality'], description: 'QC metrics for reads.', cluster: 'BIO' },
  'BIO-ALN':    { label: 'Alignment', icon: '🧭', tags: ['BAM','SAM','MSA'], description: 'Read/MSA alignment artifact.', cluster: 'BIO' },
  'BIO-ASM':    { label: 'Assembly', icon: '🧱', tags: ['contig','scaffold'], description: 'De novo or reference-guided assembly.', cluster: 'BIO' },
  'BIO-ANN':    { label: 'Annotation', icon: '🏷️', tags: ['features'], description: 'Functional/structural labels on sequences.', cluster: 'BIO' },
  'BIO-VAR':    { label: 'VariantSet', icon: '🧬', tags: ['SNP','indel','SV'], description: 'Called variants + metadata.', cluster: 'BIO' },
  'BIO-EXP':    { label: 'ExpressionMatrix', icon: '🗂️', tags: ['RNA-seq','counts'], description: 'Gene×sample expression.', cluster: 'BIO' },
  'BIO-PATH':   { label: 'PathwayMap', icon: '🗺️', tags: ['KEGG','MetaCyc'], description: 'Metabolic/signaling graph.', cluster: 'BIO' },
  'BIO-PPI':    { label: 'ProteinNetwork', icon: '🕸️', tags: ['interactome'], description: 'Protein–protein interactions.', cluster: 'BIO' },
  'BIO-PRIM':   { label: 'PrimerSet', icon: '🧷', tags: ['PCR','qPCR'], description: 'Designed primers.', cluster: 'BIO' },
  'BIO-GUIDE':  { label: 'gRNADesign', icon: '🎯', tags: ['CRISPR','off-target'], description: 'Guide selection/scoring.', cluster: 'BIO' },
  'BIO-STRUCT': { label: 'ProteinStructure', icon: '🧊', tags: ['PDB','AlphaFold'], description: '3D structure/model.', cluster: 'BIO' },



  'SYN-REG':     { label: 'RegulatoryElement', icon: '🎛️', tags: ['operator','enhancer','attenuator'], description: 'Modulate transcription/translation.', cluster: 'SYN' },
  'SYN-PLASM':   { label: 'Plasmid/Vector', icon: '🧿', tags: ['backbone','ORI','selection'], description: 'Cloning/expression vector.', cluster: 'SYN' },
  'SYN-GATE':    { label: 'GeneticLogicGate', icon: '🔀', tags: ['NOT','AND','NOR'], description: 'Combinational gene regulation.', cluster: 'SYN' },
  'SYN-DEV':     { label: 'GeneticDevice', icon: '📦', tags: ['module','cassette'], description: 'Composable module for function.', cluster: 'SYN' },
  'SYN-ASSY':    { label: 'DNAAssembly', icon: '🪛', tags: ['GoldenGate','Gibson','BioBrick'], description: 'Construct DNA from parts.', cluster: 'SYN' },
  'SYN-STRN':    { label: 'HostStrain', icon: '🧫', tags: ['E.coli','S.cerevisiae'], description: 'Chassis for construct.', cluster: 'SYN' },
  'SYN-IND':     { label: 'Inducer', icon: '💧', tags: ['IPTG','aTc','arabinose'], description: 'Control expression levels.', cluster: 'SYN' },
  'SYN-sgRNA':   { label: 'GuideRNA', icon: '🧷', tags: ['CRISPR','targeting'], description: 'Guide sequence for CRISPR.', cluster: 'SYN' },
  'SYN-CRISPR':  { label: 'CRISPRModule', icon: '✂️', tags: ['Cas9','dCas9','base-edit'], description: 'Editing or transcriptional control.', cluster: 'SYN' },
  'SYN-ASSAY':   { label: 'ReporterAssay', icon: '📈', tags: ['GFP','RFP','luminescence'], description: 'Quantify circuit behavior.', cluster: 'SYN' },
  'SYN-MODEL':   { label: 'GeneCircuitModel', icon: '🧮', tags: ['ODE','stochastic'], description: 'Dynamics model for design.', cluster: 'SYN' },
  'SYN-ORTH':    { label: 'OrthogonalityCheck', icon: '🧷', tags: ['cross-talk','specificity'], description: 'Assess unintended interactions.', cluster: 'SYN' },


// Domain: Electronics & Circuits (ELE)

  'ELE-SCHEM': { label: 'Schematic', icon: '📐', tags: ['symbols','nets'], description: 'Logical circuit diagram.', cluster: 'ELE' },
  'ELE-COMP':  { label: 'Component', icon: '🔩', tags: ['resistor','capacitor','IC'], description: 'Discrete part with params.', cluster: 'ELE' },
  'ELE-IC':    { label: 'IntegratedCircuit', icon: '🧠', tags: ['ASIC','FPGA'], description: 'Packaged semiconductor device.', cluster: 'ELE' },
  'ELE-MCU':   { label: 'Microcontroller', icon: '🧾', tags: ['ARM','AVR','RISC-V'], description: 'Programmable controller.', cluster: 'ELE' },
  'ELE-SIM':   { label: 'CircuitSimulation', icon: '🧪', tags: ['SPICE','transient','AC'], description: 'Simulation setup/results.', cluster: 'ELE' },
  'ELE-BOM':   { label: 'BillOfMaterials', icon: '📋', tags: ['parts','qty','cost'], description: 'Parts list and sourcing.', cluster: 'ELE' },
  'ELE-PWR':   { label: 'PowerDomain', icon: '🔋', tags: ['rails','regulators'], description: 'Voltage rails/topology.', cluster: 'ELE' },
  'ELE-SENS':  { label: 'Sensor', icon: '🛰️', tags: ['analog','digital'], description: 'Transducer for measurement.', cluster: 'ELE' },
  'ELE-ACT':   { label: 'Actuator', icon: '⚙️', tags: ['motor','relay','valve'], description: 'Signal → physical action.', cluster: 'ELE' },
  'ELE-DRV':   { label: 'DriverModule', icon: '🚗', tags: ['H-bridge','LED','motor'], description: 'Current/control interface.', cluster: 'ELE' },
  'ELE-FW':    { label: 'FirmwareArtifact', icon: '💾', tags: ['hex','elf','bin'], description: 'Compiled firmware image.', cluster: 'ELE' },


// Domain: PCB Design & Manufacturing (PCBX)

  'PCBX-STACK': { label: 'Stackup', icon: '🥞', tags: ['layers','dielectric'], description: 'Layer sequence/materials.', cluster: 'PCBX' },
  'PCBX-FOOT':  { label: 'Footprint', icon: '👣', tags: ['pads','land-pattern'], description: 'Landing pattern/courtyard.', cluster: 'PCBX' },
  'PCBX-NET':   { label: 'Netlist', icon: '🕸️', tags: ['connectivity'], description: 'Electrical connectivity.', cluster: 'PCBX' },
  'PCBX-RULE':  { label: 'DesignRule', icon: '📏', tags: ['clearance','width'], description: 'DFM/E constraints.', cluster: 'PCBX' },
  'PCBX-ROUT':  { label: 'RoutingTask', icon: '🧵', tags: ['tracks','vias'], description: 'Trace/via planning.', cluster: 'PCBX' },
  'PCBX-DRC':   { label: 'DRCReport', icon: '🧹', tags: ['violations'], description: 'Design rule check findings.', cluster: 'PCBX' },
  'PCBX-GERB':  { label: 'GerberBundle', icon: '🗂️', tags: ['RS-274X','Excellon'], description: 'Fabrication output set.', cluster: 'PCBX' },
  'PCBX-PNP':   { label: 'PickAndPlace', icon: '🤖', tags: ['XY','rotation'], description: 'Placement coordinates.', cluster: 'PCBX' },
  'PCBX-PCBA':  { label: 'AssemblyJob', icon: '🧰', tags: ['SMT','reflow','AOI'], description: 'Assembly plan/process.', cluster: 'PCBX' },
  'PCBX-DFM':   { label: 'DFMCheck', icon: '🔎', tags: ['fabrication','yield'], description: 'Manufacturability review.', cluster: 'PCBX' },
  'PCBX-IMP':   { label: 'ImpedanceProfile', icon: '📈', tags: ['controlled-impedance'], description: 'Target/calculated Z0.', cluster: 'PCBX' },
  'PCBX-EMC':   { label: 'EMCConstraint', icon: '📡', tags: ['return-path','shield'], description: 'EMC limits/tactics.', cluster: 'PCBX' },
  'PCBX-TEST':  { label: 'TestPointMap', icon: '📍', tags: ['ICT','flying-probe'], description: 'Test access/coverage.', cluster: 'PCBX' },

// Domain: Digital Fabrication (FAB) — additional
  'FAB-3D-MDL': { label: 'CADModel', icon: '📦', tags: ['STEP','STL','solid'], description: 'Parametric/mesh geometry.', cluster: 'FAB' },
  'FAB-PRINT':  { label: 'PrintJob', icon: '🖨️', tags: ['FDM','SLA','SLS'], description: 'Executable print task w/ settings.', cluster: 'FAB' },
  'FAB-MTRL':   { label: 'MaterialSpec', icon: '🧱', tags: ['PLA','ABS','resin','metal'], description: 'Material properties/compatibility.', cluster: 'FAB' },
  'FAB-CNC-TL': { label: 'CNCTool', icon: '🪚', tags: ['endmill','bit','diameter'], description: 'Cutting tool & wear data.', cluster: 'FAB' },
  'FAB-LASER':  { label: 'LaserJob', icon: '🔦', tags: ['cut','engrave','power','speed'], description: 'Vector/bitmap laser process.', cluster: 'FAB' },
  'FAB-TOL':    { label: 'ToleranceSpec', icon: '🎯', tags: ['fit','GD&T'], description: 'Dimensional & geometric tolerances.', cluster: 'FAB' },
  'FAB-QA':     { label: 'MetrologyRecord', icon: '📏', tags: ['CMM','caliper','deviation'], description: 'Measured vs nominal CAD.', cluster: 'FAB' },
  'FAB-JIG':    { label: 'Jig/Fixture', icon: '🧩', tags: ['workholding','assembly'], description: 'Aux hardware to stabilize parts.', cluster: 'FAB' },

// Domain: Microfluidics (MFL)
  'MFL-CHIP': { label: 'MicrofluidicChip', icon: '🧩', tags: ['lab-on-chip','PDMS','glass'], description: 'Integrated device with channels/modules.', cluster: 'MFL' },
  'MFL-CHN':  { label: 'ChannelNetwork', icon: '🕸️', tags: ['channels','mixers','splitters'], description: 'Topology & dimensions.', cluster: 'MFL' },
  'MFL-PMP':  { label: 'Micropump', icon: '🫧', tags: ['peristaltic','electroosmotic'], description: 'Fluid propulsion element.', cluster: 'MFL' },
  'MFL-VAL':  { label: 'Microvalve', icon: '🚪', tags: ['pneumatic','thermo'], description: 'Controllable flow gating.', cluster: 'MFL' },
  'MFL-SENS': { label: 'FluidicSensor', icon: '🧪', tags: ['pressure','flow','pH'], description: 'On-chip measurements.', cluster: 'MFL' },
  'MFL-FAB':  { label: 'MicrofabProcess', icon: '🛠️', tags: ['soft-lithography','bonding'], description: 'Process steps/parameters.', cluster: 'MFL' },


// Domain: Lab Automation (LBA)
  'LBA-WORK':  { label: 'Workcell', icon: '🏗️', tags: ['integrated','island'], description: 'Coordinated instruments.', cluster: 'LBA' },
  'LBA-LIMS':  { label: 'LIMSRecord', icon: '🗄️', tags: ['samples','traceability'], description: 'Sample/reagent/run metadata.', cluster: 'LBA' },
  'LBA-ROBOT': { label: 'LiquidHandler', icon: '🤖', tags: ['pipetting','deck'], description: 'Automated pipetting/dispensing.', cluster: 'LBA' },
  'LBA-SCH':   { label: 'Scheduler', icon: '🗓️', tags: ['protocol','queues'], description: 'Plan with resource/timing.', cluster: 'LBA' },
  'LBA-SOP':   { label: 'AutomatedSOP', icon: '📋', tags: ['protocol','steps'], description: 'Machine-readable SOP.', cluster: 'LBA' },
  'LBA-QC':    { label: 'RunQC', icon: '✅', tags: ['controls','drift'], description: 'Automated run checks.', cluster: 'LBA' },



  'MAT-COMP':  { label: 'Composition', icon: '🧪', tags: ['alloy','polymer','ceramic'], description: 'Constituent elements/phases.', cluster: 'MAT' },
  'MAT-PROC':  { label: 'ProcessRoute', icon: '🧰', tags: ['heat-treat','additive','casting'], description: 'Processing sequence.', cluster: 'MAT' },
  'MAT-MICRO': { label: 'Microstructure', icon: '🔬', tags: ['grain','phase','defect'], description: 'Features impacting properties.', cluster: 'MAT' },
  'MAT-PROP':  { label: 'PropertySet', icon: '📈', tags: ['mechanical','thermal','electrical'], description: 'Measured/modeled properties.', cluster: 'MAT' },
  'MAT-STND':  { label: 'StandardsRef', icon: '📚', tags: ['ASTM','ISO'], description: 'Applicable standards.', cluster: 'MAT' },


// Domain: Optics & Photonics (OPT)

  'OPT-SRC':   { label: 'LightSource', icon: '💡', tags: ['laser','LED','SLD'], description: 'Spectrum/coherence properties.', cluster: 'OPT' },
  'OPT-ELM':   { label: 'OpticalElement', icon: '🔍', tags: ['lens','mirror','filter'], description: 'Passive/active transfer function.', cluster: 'OPT' },
  'OPT-PTH':   { label: 'OpticalPath', icon: '🛤️', tags: ['beampath','alignment'], description: 'Layout/alignment of train.', cluster: 'OPT' },
  'OPT-DET':   { label: 'Photodetector', icon: '📟', tags: ['APD','PMT','CMOS'], description: 'Responsivity/noise metrics.', cluster: 'OPT' },
  'OPT-SPC':   { label: 'SpectralProfile', icon: '🌈', tags: ['spectrum','bandwidth'], description: 'Source/filter characteristics.', cluster: 'OPT' },
  'OPT-INTF':  { label: 'Interferometer', icon: '🪞', tags: ['Michelson','Fabry–Pérot'], description: 'Interference-based measurement.', cluster: 'OPT' },


// Domain: Robotics & Mechatronics (ROB)

  'ROB-MECH':  { label: 'Mechanism', icon: '⚙️', tags: ['linkage','geartrain'], description: 'Kinematic chain.', cluster: 'ROB' },
  'ROB-DRV':   { label: 'ActuationUnit', icon: '🧲', tags: ['servo','stepper','hydraulic'], description: 'Actuator + drive.', cluster: 'ROB' },
  'ROB-KIN':   { label: 'KinematicModel', icon: '📐', tags: ['DH','forward','inverse'], description: 'Kinematics/workspace.', cluster: 'ROB' },
  'ROB-DYN':   { label: 'DynamicsModel', icon: '🧮', tags: ['inertia','friction'], description: 'Equations of motion.', cluster: 'ROB' },
  'ROB-PLN':   { label: 'MotionPlan', icon: '🗺️', tags: ['path','trajectory'], description: 'Time-parameterized path.', cluster: 'ROB' },
  'ROB-EOAT':  { label: 'EndEffector', icon: '🦾', tags: ['gripper','tool'], description: 'Task-specific tool.', cluster: 'ROB' },


// Domain: Control Systems (CTR)
  'CTR-PLANT': { label: 'PlantModel', icon: '🌿', tags: ['state-space','transfer'], description: 'System to be controlled.', cluster: 'CTR' },
  'CTR-CONT':  { label: 'Controller', icon: '🎚️', tags: ['PID','LQR','MPC'], description: 'Feedback/optimal control.', cluster: 'CTR' },
  'CTR-OBS':   { label: 'Observer', icon: '🛰️', tags: ['Kalman','Luenberger'], description: 'State estimator.', cluster: 'CTR' },
  'CTR-REF':   { label: 'ReferenceProfile', icon: '🧭', tags: ['setpoint','trajectory'], description: 'Desired output over time.', cluster: 'CTR' },
  'CTR-SAT':   { label: 'ConstraintSet', icon: '🚧', tags: ['saturation','rates'], description: 'Hard/soft limits.', cluster: 'CTR' },


// Domain: Signal Processing (DSP)

  'DSP-ACQ':   { label: 'AcquisitionChain', icon: '🎙️', tags: ['ADC','sampling'], description: 'Front-end & digitization.', cluster: 'DSP' },
  'DSP-FILT':  { label: 'FilterBlock', icon: '🪣', tags: ['FIR','IIR','window'], description: 'Digital filter & response.', cluster: 'DSP' },
  'DSP-TRFM':  { label: 'Transform', icon: '🔄', tags: ['FFT','DWT'], description: 'Domain transform.', cluster: 'DSP' },
  'DSP-FEAT':  { label: 'FeatureSet', icon: '🧷', tags: ['spectral','temporal'], description: 'Extracted features.', cluster: 'DSP' },
  'DSP-DET':   { label: 'Detector', icon: '🎯', tags: ['threshold','matched'], description: 'Decision logic/metrics.', cluster: 'DSP' },


// Domain: RF & Microwave (RF)

  'RF-BLK':    { label: 'RFBlock', icon: '📶', tags: ['LNA','mixer','PA'], description: 'Functional RF stage.', cluster: 'RF' },
  'RF-MATCH':  { label: 'MatchingNetwork', icon: '🧩', tags: ['π','L','Smith'], description: 'Impedance transformation.', cluster: 'RF' },
  'RF-TLN':    { label: 'TransmissionLine', icon: '🧵', tags: ['microstrip','CPW'], description: 'Guided structure (Z0).', cluster: 'RF' },
  'RF-ANT':    { label: 'Antenna', icon: '📡', tags: ['dipole','patch','array'], description: 'Pattern/gain/efficiency.', cluster: 'RF' },
  'RF-EM':     { label: 'EMSimulation', icon: '🧪', tags: ['MoM','FEM','FDTD'], description: 'Full-wave/circuit-EM co-sim.', cluster: 'RF' },


// Domain: Power Electronics (PWR)

  'PWR-TOP':   { label: 'ConverterTopology', icon: '🔁', tags: ['buck','boost','LLC'], description: 'Power stage & mode.', cluster: 'PWR' },
  'PWR-MAG':   { label: 'Magnetics', icon: '🧲', tags: ['inductor','transformer'], description: 'Core/winding/loss model.', cluster: 'PWR' },
  'PWR-CTRL':  { label: 'PowerController', icon: '🎚️', tags: ['PWM','current-mode'], description: 'Loop & compensation.', cluster: 'PWR' },
  'PWR-THERM': { label: 'ThermalModel', icon: '🌡️', tags: ['RθJA','derating'], description: 'Thermal path/limits.', cluster: 'PWR' },
  'PWR-PROT':  { label: 'ProtectionBlock', icon: '🛡️', tags: ['OVP','OCP','SCP'], description: 'Fault detection/protection.', cluster: 'PWR' },


// Domain: Semiconductor Process (SEM)

  'SEM-WFR':   { label: 'WaferLot', icon: '🥮', tags: ['substrate','lot'], description: 'Wafer batch/material/dopant.', cluster: 'SEM' },
  'SEM-LITHO': { label: 'LithographyStep', icon: '🖨️', tags: ['resist','exposure','mask'], description: 'Patterning parameters.', cluster: 'SEM' },
  'SEM-DOP':   { label: 'DopingStep', icon: '🧂', tags: ['implant','diffusion'], description: 'Species/doses/activation.', cluster: 'SEM' },
  'SEM-ETCH':  { label: 'EtchStep', icon: '🧼', tags: ['RIE','wet'], description: 'Removal chemistry/profiles.', cluster: 'SEM' },
  'SEM-DEP':   { label: 'DepositionStep', icon: '🧴', tags: ['CVD','PVD','ALD'], description: 'Thin-film deposition.', cluster: 'SEM' },
  'SEM-MET':   { label: 'Metallization', icon: '🔩', tags: ['BEOL','interconnect'], description: 'Metal layers/vias/Reliability.', cluster: 'SEM' },


// Domain: Chemistry & Wet Lab (CHE)

  'CHE-RGT':   { label: 'Reagent', icon: '🧴', tags: ['purity','stability'], description: 'Lot/hazard/storage.', cluster: 'CHE' },
  'CHE-RXN':   { label: 'Reaction', icon: '⚗️', tags: ['stoichiometry','kinetics'], description: 'Balanced reaction & rates.', cluster: 'CHE' },
  'CHE-MX':    { label: 'Mixture', icon: '🥣', tags: ['buffer','media'], description: 'Components & concentrations.', cluster: 'CHE' },
  'CHE-ANAL':  { label: 'AnalyticalMethod', icon: '🧪', tags: ['HPLC','GC-MS','titration'], description: 'Quant/qual assay.', cluster: 'CHE' },
  'CHE-SAF':   { label: 'SafetyProfile', icon: '☣️', tags: ['GHS','PPE','waste'], description: 'Hazards/handling/disposal.', cluster: 'CHE' },


// Domain: Metrology & Calibration (MTR)
  'MTR-STD':   { label: 'ReferenceStandard', icon: '🎚️', tags: ['primary','secondary'], description: 'Calibration standard.', cluster: 'MTR' },
  'MTR-MEAS':  { label: 'MeasurementPlan', icon: '📑', tags: ['method','repeatability'], description: 'Measurand/method/env.', cluster: 'MTR' },
  'MTR-UNC':   { label: 'UncertaintyBudget', icon: '🧮', tags: ['GUM','contributors'], description: 'Uncertainty analysis.', cluster: 'MTR' },
  'MTR-CAL':   { label: 'CalibrationRecord', icon: '🗃️', tags: ['certificate','interval'], description: 'Instrument calibration.', cluster: 'MTR' },
  'MTR-GAUG':  { label: 'GaugeR&R', icon: '📊', tags: ['MSA','ANOVA'], description: 'Repeatability/reproducibility.', cluster: 'MTR' },


// Domain: Nondestructive Testing (NDT)

  'NDT-MTH':   { label: 'NDTMethod', icon: '🧰', tags: ['UT','RT','VT','PT','MT','ET'], description: 'Inspection modality.', cluster: 'NDT' },
  'NDT-PROC':  { label: 'InspectionProcedure', icon: '📋', tags: ['coverage','sensitivity'], description: 'Stepwise inspection method.', cluster: 'NDT' },
  'NDT-IND':   { label: 'Indication', icon: '📍', tags: ['defect','signal'], description: 'Detected feature & severity.', cluster: 'NDT' },
  'NDT-EVAL':  { label: 'AcceptanceCriteria', icon: '✅', tags: ['standard','limits'], description: 'Pass/fail thresholds.', cluster: 'NDT' },
  'NDT-REP':   { label: 'InspectionReport', icon: '📝', tags: ['traceability','images'], description: 'Results with evidence/sign-off.', cluster: 'NDT' },

  // Translation & Localization (TRN-*) — TRN cluster already exists
  'TRN-TASK':  { label: 'TranslationTask', icon: '📝', tags: ['mt','human','post-edit'], description: 'Unit of work with source, target, and domain.', cluster: 'TRN' },
  'TRN-GLOSS': { label: 'TerminologyGlossary', icon: '🏷️', tags: ['terms','TBX'], description: 'Curated termbase with usage rules.', cluster: 'TRN' },
  'TRN-MEM':   { label: 'TranslationMemory', icon: '💾', tags: ['TMX','segments'], description: 'Aligned source–target segments for reuse.', cluster: 'TRN' },
  'TRN-QA':    { label: 'L10nQAProfile', icon: '✅', tags: ['checks','LQA'], description: 'Automated and manual quality criteria.', cluster: 'TRN' },
  'TRN-LOC':   { label: 'LocaleProfile', icon: '🌍', tags: ['i18n','BCP47'], description: 'Locale rules, formats, pluralization.', cluster: 'TRN' },

  // Formal Verification & Assurance (FOR-*)
  'FOR-SPEC':  { label: 'FormalSpec', icon: '📜', tags: ['TLA+','Coq','Z'], description: 'Mathematical system requirements.', cluster: 'FOR' },
  'FOR-MDL':   { label: 'FormalModel', icon: '📐', tags: ['state','invariant'], description: 'Abstract model with invariants and properties.', cluster: 'FOR' },
  'FOR-PROOF': { label: 'ProofArtifact', icon: '✒️', tags: ['theorem','lemma'], description: 'Machine-checked proof of properties.', cluster: 'FOR' },
  'FOR-MC':    { label: 'ModelCheck', icon: '🧪', tags: ['CTL','LTL'], description: 'Exhaustive state exploration results.', cluster: 'FOR' },
  'FOR-ABST':  { label: 'AbstractionMap', icon: '🗺️', tags: ['refinement'], description: 'Link between concrete and abstract models.', cluster: 'FOR' },

  // Reliability & Safety (RLY-*)
  'RLY-FTA':   { label: 'FaultTree', icon: '🌲', tags: ['AND','OR','cutset'], description: 'Top-down failure logic model.', cluster: 'RLY' },
  'RLY-FMEA':  { label: 'FMEA', icon: '📋', tags: ['severity','occurrence','RPN'], description: 'Failure modes and effects analysis.', cluster: 'RLY' },
  'RLY-HAZ':   { label: 'HAZOP', icon: '⚠️', tags: ['deviation','guideword'], description: 'Systematic hazard identification.', cluster: 'RLY' },
  'RLY-SIL':   { label: 'SafetyIntegrity', icon: '🧯', tags: ['IEC61508','SIL'], description: 'Target safety level allocation.', cluster: 'RLY' },
  'RLY-RAM':   { label: 'RAMModel', icon: '⛓️', tags: ['reliability','availability','maintainability'], description: 'RAM metrics and predictions.', cluster: 'RLY' },

  // Human Factors & HCI (HFE-*)
  'HFE-ERG':   { label: 'ErgonomicProfile', icon: '🪑', tags: ['anthro','reach'], description: 'Physical and cognitive ergonomic constraints.', cluster: 'HFE' },
  'HFE-UXR':   { label: 'UserResearch', icon: '🔎', tags: ['interview','usability'], description: 'Findings and personas from studies.', cluster: 'HFE' },
  'HFE-UI':    { label: 'InterfaceSpec', icon: '🖥️', tags: ['layout','flow'], description: 'Interaction patterns and states.', cluster: 'HFE' },
  'HFE-ACC':   { label: 'AccessibilityReq', icon: '♿', tags: ['WCAG','a11y'], description: 'Perceivable, operable, understandable, robust.', cluster: 'HFE' },
  'HFE-PROT':  { label: 'Prototype', icon: '🧩', tags: ['low-fi','hi-fi'], description: 'Interactive artifact for validation.', cluster: 'HFE' },

  // Operations Research & Optimization (ORX-*)
  'ORX-LP':    { label: 'LinearProgram', icon: '📏', tags: ['LP','simplex'], description: 'Linear objective with linear constraints.', cluster: 'ORX' },
  'ORX-IP':    { label: 'IntegerProgram', icon: '🔢', tags: ['MIP','MILP'], description: 'Discrete decision optimization model.', cluster: 'ORX' },
  'ORX-QP':    { label: 'QuadraticProgram', icon: '🧊', tags: ['QP','QCQP'], description: 'Quadratic objective optimization.', cluster: 'ORX' },
  'ORX-FLW':   { label: 'NetworkFlow', icon: '🕳️', tags: ['max-flow','min-cost'], description: 'Flow optimization on graphs.', cluster: 'ORX' },
  'ORX-SCH':   { label: 'SchedulingModel', icon: '🗓️', tags: ['job-shop','RCPSP'], description: 'Resource-constrained scheduling.', cluster: 'ORX' },

  // Information Theory & Coding (ITY-*)
  'ITY-ENT':   { label: 'EntropyModel', icon: '🧠', tags: ['H(X)'], description: 'Uncertainty measure over symbols.', cluster: 'ITY' },
  'ITY-MI':    { label: 'MutualInformation', icon: '🔗', tags: ['I(X;Y)'], description: 'Shared information between variables.', cluster: 'ITY' },
  'ITY-CAP':   { label: 'ChannelCapacity', icon: '📶', tags: ['Shannon'], description: 'Max reliable rate over a channel.', cluster: 'ITY' },
  'ITY-SRC':   { label: 'SourceCoding', icon: '🗜️', tags: ['Huffman','arithmetic'], description: 'Lossless compression scheme.', cluster: 'ITY' },
  'ITY-CODE':  { label: 'ErrorCorrectingCode', icon: '🧷', tags: ['LDPC','RS','CRC'], description: 'Coding for detection and correction.', cluster: 'ITY' },

  // Networks & Graphs (NET-*)
  'NET-G':     { label: 'Graph', icon: '🧩', tags: ['nodes','edges'], description: 'Typed graph with attributes.', cluster: 'NET' },
  'NET-CENT':  { label: 'CentralitySet', icon: '🎯', tags: ['degree','betweenness'], description: 'Network importance metrics.', cluster: 'NET' },
  'NET-FLOW':  { label: 'FlowNetwork', icon: '🌊', tags: ['capacity','cuts'], description: 'Directed capacitated network.', cluster: 'NET' },
  'NET-ALG':   { label: 'GraphAlgorithm', icon: '🧮', tags: ['shortest-path','MST'], description: 'Algorithm artifact and results.', cluster: 'NET' },
  'NET-RND':   { label: 'RandomGraphModel', icon: '🎲', tags: ['ER','BA'], description: 'Generative network model.', cluster: 'NET' },

  // Modeling & Simulation (SIM-*)
  'SIM-ABM':   { label: 'AgentBasedModel', icon: '👥', tags: ['agents','rules'], description: 'Micro-to-macro emergent simulation.', cluster: 'SIM' },
  'SIM-SDE':   { label: 'StochasticDynamics', icon: '🌫️', tags: ['SDE','MonteCarlo'], description: 'Noise-driven system evolution.', cluster: 'SIM' },
  'SIM-FEA':   { label: 'FiniteElementModel', icon: '🧱', tags: ['FEA','mesh'], description: 'Discretized continuum analysis.', cluster: 'SIM' },
  'SIM-CFD':   { label: 'CFDModel', icon: '💨', tags: ['Navier–Stokes'], description: 'Fluid simulation configuration.', cluster: 'SIM' },
  'SIM-DES':   { label: 'DiscreteEventSim', icon: '⏯️', tags: ['queue','event'], description: 'Event-driven system simulator.', cluster: 'SIM' },

  // Statistics & DOE (STA-*)
  'STA-EST':   { label: 'Estimator', icon: '📐', tags: ['MLE','MAP'], description: 'Parameter estimation object.', cluster: 'STA' },
  'STA-TEST':  { label: 'HypothesisTest', icon: '🧪', tags: ['t-test','ANOVA'], description: 'Statistical test definition/results.', cluster: 'STA' },
  'STA-DOE':   { label: 'DesignOfExperiments', icon: '🧭', tags: ['factorial','RSM'], description: 'Planned experiments for inference/optimization.', cluster: 'STA' },
  'STA-BAYES': { label: 'BayesianModel', icon: '🎛️', tags: ['prior','posterior'], description: 'Probabilistic model with inference.', cluster: 'STA' },
  'STA-QUAL':  { label: 'QualityControlChart', icon: '📈', tags: ['SPC','CUSUM'], description: 'Process monitoring artifact.', cluster: 'STA' },

  // Embedded & Real-Time (EMB-*)
  'EMB-RTOS':  { label: 'RTOSProfile', icon: '🧭', tags: ['sched','latency'], description: 'Kernel, scheduling, and timing config.', cluster: 'EMB' },
  'EMB-DRV':   { label: 'DeviceDriver', icon: '🧩', tags: ['HAL','ISR'], description: 'Hardware interface component.', cluster: 'EMB' },
  'EMB-BSP':   { label: 'BoardSupportPkg', icon: '🧿', tags: ['boot','startup'], description: 'Initialization and board glue.', cluster: 'EMB' },
  'EMB-IPC':   { label: 'InterprocessComm', icon: '🔗', tags: ['queue','mailbox'], description: 'RT-safe messaging primitives.', cluster: 'EMB' },
  'EMB-SAFE':  { label: 'FunctionalSafetySW', icon: '🛡️', tags: ['ISO26262','DO-178C'], description: 'Safety-certified software unit.', cluster: 'EMB' },

  // Observability & Telemetry (OBS-*)
  'OBS-LOG':   { label: 'LogStream', icon: '🗒️', tags: ['structured','schema'], description: 'Event logs with schema and retention.', cluster: 'OBS' },
  'OBS-MET':   { label: 'MetricSet', icon: '📏', tags: ['gauge','counter','histogram'], description: 'Time-series metrics definition.', cluster: 'OBS' },
  'OBS-TRC':   { label: 'TraceSpan', icon: '🧵', tags: ['context','latency'], description: 'Distributed trace segment.', cluster: 'OBS' },
  'OBS-ALR':   { label: 'AlertPolicy', icon: '🚨', tags: ['threshold','SLO'], description: 'Condition-action for incidents.', cluster: 'OBS' },
  'OBS-DASH':  { label: 'ObservabilityDashboard', icon: '📊', tags: ['viz','runbook'], description: 'Linked views for ops diagnosis.', cluster: 'OBS' },

  // Geospatial & Remote Sensing (GEO-*)
  'GEO-CRS':   { label: 'CoordinateRefSys', icon: '📐', tags: ['EPSG','proj'], description: 'Spatial reference and transforms.', cluster: 'GEO' },
  'GEO-RST':   { label: 'RasterProduct', icon: '🖼️', tags: ['GeoTIFF','tiles'], description: 'Gridded imagery with georeferencing.', cluster: 'GEO' },
  'GEO-VEC':   { label: 'VectorDataset', icon: '🧭', tags: ['points','lines','polygons'], description: 'Feature geometries with attributes.', cluster: 'GEO' },
  'GEO-DTM':   { label: 'TerrainModel', icon: '⛰️', tags: ['DEM','DTM','DSM'], description: 'Surface or elevation model.', cluster: 'GEO' },
  'GEO-GNSS':  { label: 'GNSSObservation', icon: '📡', tags: ['GPS','RTK'], description: 'Satellite positioning measurements.', cluster: 'GEO' },

// ============================================================================
// AI/ML node types (unique, missing only)
// ============================================================================

  'AIM-TASK':   { label: 'MLTask', icon: '🎯', tags: ['classification','generation','ranking'], description: 'Well-defined prediction or generation objective.', cluster: 'AIM' },
  'AIM-MODEL':  { label: 'ModelFamily', icon: '🧬', tags: ['transformer','tree','linear'], description: 'Parametric architecture class and variants.', cluster: 'AIM' },
  'AIM-PPL':    { label: 'Pipeline', icon: '🧩', tags: ['train','eval','infer'], description: 'Composable steps from data to predictions.', cluster: 'AIM' },
  'AIM-DSET':   { label: 'Dataset', icon: '🗂️', tags: ['train','val','test'], description: 'Versioned data with schema and license.', cluster: 'AIM' },
  'AIM-METRIC': { label: 'Metric', icon: '📏', tags: ['accuracy','BLEU','ROUGE'], description: 'Quantitative quality measure.', cluster: 'AIM' },

  // Large Language Models (LLM-*)
  'LLM-PROMPT': { label: 'PromptSpec', icon: '📝', tags: ['system','few-shot','tool-use'], description: 'Structured prompt with roles, shots, and constraints.', cluster: 'LLM' },
  'LLM-CTX':    { label: 'ContextWindow', icon: '🪟', tags: ['tokens','position'], description: 'Effective token budget and packing strategy.', cluster: 'LLM' },
  'LLM-DEC':    { label: 'DecodingPolicy', icon: '🧵', tags: ['greedy','sampling','beam'], description: 'Inference strategy and parameters.', cluster: 'LLM' },
  'LLM-SFT':    { label: 'SupervisedFinetuneSet', icon: '🎒', tags: ['instruction','chat'], description: 'Curated input-output pairs for SFT.', cluster: 'LLM' },
  'LLM-ALIGN':  { label: 'AlignmentRecipe', icon: '🧭', tags: ['RLHF','DPO','KTO'], description: 'Post-training alignment configuration.', cluster: 'LLM' },

  // Agents & Personas (AGT-*)
  'AGT-ARCH':   { label: 'AgentArchitecture', icon: '🏗️', tags: ['react','plan-exec','swarm'], description: 'Planning, memory, and tool orchestration design.', cluster: 'AGT' },
  'AGT-PER':    { label: 'Persona', icon: '🪪', tags: ['role','tone','capabilities'], description: 'Operational profile with constraints and goals.', cluster: 'AGT' },
  'AGT-MEM':    { label: 'AgentMemory', icon: '🧠', tags: ['episodic','semantic','vector'], description: 'Memory store and retrieval policies.', cluster: 'AGT' },
  'AGT-TOOL':   { label: 'ToolBinding', icon: '🛠️', tags: ['api','function-calling'], description: 'Typed tool definitions and affordances.', cluster: 'AGT' },
  'AGT-EVAL':   { label: 'AgentEval', icon: '🧪', tags: ['task-suite','success-rate'], description: 'Objective tasks and rubric for agents.', cluster: 'AGT' },

  // Retrieval-Augmented Generation (RAG-*)
  'RAG-INDEX':  { label: 'Index', icon: '📚', tags: ['vector','hybrid','inverted'], description: 'Search index with schema and store config.', cluster: 'RAG' },
  'RAG-EMB':    { label: 'EmbeddingModel', icon: '🧲', tags: ['text','image','multimodal'], description: 'Encoder with dims, space, and training data.', cluster: 'RAG' },
  'RAG-ROUTE':  { label: 'Router', icon: '🧭', tags: ['query-class','tool-select'], description: 'Dynamic selection among retrievers or tools.', cluster: 'RAG' },
  'RAG-FUSE':   { label: 'FusionPolicy', icon: '🧪', tags: ['RRF','re-rank','merge'], description: 'Combine retrieved evidence into context.', cluster: 'RAG' },
  'RAG-GRD':    { label: 'GroundingRecord', icon: '🪵', tags: ['citations','provenance'], description: 'Traceable sources attached to outputs.', cluster: 'RAG' },

  // MLOps Lifecycle (MLO-*)
  'MLO-REG':    { label: 'ModelRegistry', icon: '📦', tags: ['versions','stages'], description: 'Canonical store for model artifacts and lineage.', cluster: 'MLO' },
  'MLO-CI':     { label: 'MLCICD', icon: '🧰', tags: ['train-ci','deploy-cd'], description: 'Automated build, test, and release flows.', cluster: 'MLO' },
  'MLO-MON':    { label: 'ModelMonitor', icon: '📡', tags: ['drift','latency','SLO'], description: 'Online telemetry and guardrails.', cluster: 'MLO' },
  'MLO-FEAT':   { label: 'FeatureStore', icon: '🏪', tags: ['offline','online'], description: 'Managed features with serving/consistency.', cluster: 'MLO' },
  'MLO-PRIV':   { label: 'ComplianceProfile', icon: '📜', tags: ['PII','licensing'], description: 'Policy, consent, license, and retention rules.', cluster: 'MLO' },

  // Data & Feature Engineering (DSE-*)
  'DSE-SPEC':   { label: 'DatasetSpec', icon: '📑', tags: ['schema','splits'], description: 'Columns, types, units, and partitions.', cluster: 'DSE' },
  'DSE-LBL':    { label: 'LabelingJob', icon: '🏷️', tags: ['human','programmatic'], description: 'Annotation workflow and ontology.', cluster: 'DSE' },
  'DSE-QA':     { label: 'DataQualityReport', icon: '🔬', tags: ['missing','bias','leakage'], description: 'Quality, bias, and leakage checks.', cluster: 'DSE' },
  'DSE-AUG':    { label: 'AugmentationPolicy', icon: '🧪', tags: ['text','image','audio'], description: 'Transformations for robustness.', cluster: 'DSE' },
  'DSE-SYN':    { label: 'SyntheticDataGen', icon: '🧯', tags: ['sim','GAN','diffusion'], description: 'Procedural or model-based data creation.', cluster: 'DSE' },

  // Evaluation & Benchmarking (EVA-*)
  'EVA-SUITE':  { label: 'BenchmarkSuite', icon: '🗃️', tags: ['taskset','domains'], description: 'Curated tasks with protocols.', cluster: 'EVA' },
  'EVA-MTRC':   { label: 'EvalMetric', icon: '📐', tags: ['exact-match','F1','BERTScore'], description: 'Task-aligned scoring function.', cluster: 'EVA' },
  'EVA-HH':     { label: 'HumanEvalPanel', icon: '🧑‍⚖️', tags: ['rubric','double-blind'], description: 'Human judgments with reliability stats.', cluster: 'EVA' },
  'EVA-RT':     { label: 'AdversarialEval', icon: '🧨', tags: ['jailbreak','prompt-injection'], description: 'Stress tests for robustness and safety.', cluster: 'EVA' },
  'EVA-COV':    { label: 'CoverageMap', icon: '🗺️', tags: ['spec','edge-cases'], description: 'Test coverage vs capability map.', cluster: 'EVA' },

  // Safety & Alignment (SAF-*)
  'SAF-POL':    { label: 'PolicySet', icon: '📚', tags: ['content','usage'], description: 'Allowed, restricted, and blocked behaviors.', cluster: 'SAF' },
  'SAF-ALN':    { label: 'AlignmentMethod', icon: '🧲', tags: ['RLHF','DPO','constitutional'], description: 'Procedure to align model behaviors.', cluster: 'SAF' },
  'SAF-RISK':   { label: 'RiskRegister', icon: '🧯', tags: ['harm','misuse'], description: 'Identified risks with mitigations and owners.', cluster: 'SAF' },
  'SAF-ATK':    { label: 'SafetyAttack', icon: '🕳️', tags: ['prompt-injection','data-exfil'], description: 'Attack pattern definitions and signatures.', cluster: 'SAF' },
  'SAF-GUARD':  { label: 'Guardrail', icon: '🛑', tags: ['filters','refusal','grounding'], description: 'Runtime checks and interventions.', cluster: 'SAF' },

  // Interpretability (INT-*)
  'INT-ATTR':   { label: 'AttributionMap', icon: '🗺️', tags: ['saliency','integrated-gradients'], description: 'Token/feature contribution estimates.', cluster: 'INT' },
  'INT-CONC':   { label: 'ConceptProbe', icon: '🧪', tags: ['linear-probe','CCA'], description: 'Latent concept detection and ratings.', cluster: 'INT' },
  'INT-CIRC':   { label: 'CircuitAnalysis', icon: '🔬', tags: ['path-patching','activation-steering'], description: 'Mechanistic chains within networks.', cluster: 'INT' },
  'INT-FTNT':   { label: 'FeatureNeuron', icon: '🧩', tags: ['unit','polysemantic'], description: 'Identified neuron or feature semantics.', cluster: 'INT' },
  'INT-PRUN':   { label: 'PruningPlan', icon: '✂️', tags: ['sparsity','lottery-ticket'], description: 'Structured/unstructured pruning recipe.', cluster: 'INT' },

  // Optimization & Training (OPTA-*)
  'OPTA-OBJ':   { label: 'Objective', icon: '🎯', tags: ['xent','contrastive','SFT'], description: 'Loss and constraints for training.', cluster: 'OPTA' },
  'OPTA-SCH':   { label: 'LRschedule', icon: '📉', tags: ['cosine','one-cycle'], description: 'Learning rate and warmup policy.', cluster: 'OPTA' },
  'OPTA-FT':    { label: 'FinetuneAdapter', icon: '🧷', tags: ['LoRA','QLoRA','IA3'], description: 'Adapter method and target modules.', cluster: 'OPTA' },
  'OPTA-MIX':   { label: 'MixingStrategy', icon: '🥣', tags: ['curriculum','mixture-of-data'], description: 'Data/task weighting over epochs.', cluster: 'OPTA' },
  'OPTA-HP':    { label: 'HPTuning', icon: '🎛️', tags: ['grid','bayes','pbt'], description: 'Hyperparameter search configuration.', cluster: 'OPTA' },

  // Inference & Serving (INF-*)
  'INF-RUN':    { label: 'RuntimeProfile', icon: '🏎️', tags: ['GPU','TPU','CPU'], description: 'Kernel, precision, and memory plan.', cluster: 'INF' },
  'INF-BATCH':  { label: 'BatchingPolicy', icon: '🧺', tags: ['dynamic','static'], description: 'Batch size, padding, and latency targets.', cluster: 'INF' },
  'INF-CACHE':  { label: 'KVCachePlan', icon: '🗄️', tags: ['paged','quantized'], description: 'Attention cache layout and reuse.', cluster: 'INF' },
  'INF-RTN':    { label: 'RoutingGraph', icon: '🧭', tags: ['ensemble','mixture'], description: 'Traffic across models/tools by policy.', cluster: 'INF' },
  'INF-QNT':    { label: 'QuantizationSpec', icon: '🧮', tags: ['INT8','FP8','AWQ'], description: 'Quant scheme, calibration, and error budget.', cluster: 'INF' },

  // Knowledge Graphs & Ontologies (KGE-*)
  'KGE-SCHEM':  { label: 'Schema', icon: '📚', tags: ['RDF','OWL','SHACL'], description: 'Classes, relations, constraints.', cluster: 'KGE' },
  'KGE-GRAPH':  { label: 'KnowledgeGraph', icon: '🕸️', tags: ['triples','properties'], description: 'Typed graph with provenance.', cluster: 'KGE' },
  'KGE-LINK':   { label: 'LinkingPolicy', icon: '🔗', tags: ['entity-res','fusion'], description: 'Rules for entity resolution and merge.', cluster: 'KGE' },
  'KGE-REASON': { label: 'ReasonerConfig', icon: '🧠', tags: ['DL','rules'], description: 'Entailment and constraint checking.', cluster: 'KGE' },
  'KGE-ETL':    { label: 'GraphETL', icon: '🪜', tags: ['ingest','mapping'], description: 'Pipelines from raw data to triples.', cluster: 'KGE' },

  // Multimodal AI (MM-*)
  'MM-VIS':     { label: 'VisionBackbone', icon: '👁️', tags: ['CNN','ViT','SAM'], description: 'Visual encoder and checkpoint.', cluster: 'MM' },
  'MM-AUD':     { label: 'AudioBackbone', icon: '🎙️', tags: ['wav2vec','Conformer'], description: 'Audio/speech encoder.', cluster: 'MM' },
  'MM-FUSE':    { label: 'FusionModule', icon: '🧯', tags: ['cross-attn','projection'], description: 'Cross-modal alignment and fusion.', cluster: 'MM' },
  'MM-LLAVA':   { label: 'VisLangAdapter', icon: '🖼️', tags: ['image-to-text'], description: 'Adapters connecting encoders to LLM.', cluster: 'MM' },
  'MM-EVAL':    { label: 'MultimodalEval', icon: '🧪', tags: ['VQA','caption','ASR'], description: 'Task suite for multimodal models.', cluster: 'MM' },

  // Reinforcement Learning (RL-*)
  'RL-ENV':     { label: 'Environment', icon: '🌍', tags: ['gym','dm_control'], description: 'MDP/PO-MDP definition with API.', cluster: 'RL' },
  'RL-POL':     { label: 'Policy', icon: '📜', tags: ['actor-critic','Q','world-model'], description: 'Mapping from states to actions.', cluster: 'RL' },
  'RL-BUF':     { label: 'ReplayBuffer', icon: '🧺', tags: ['off-policy','prio'], description: 'Experience store and sampling.', cluster: 'RL' },
  'RL-ALG':     { label: 'RLAlgorithm', icon: '🧮', tags: ['PPO','SAC','DQN','IL'], description: 'Learning rule and updates.', cluster: 'RL' },
  'RL-EVAL':    { label: 'RLEvaluation', icon: '🧭', tags: ['return','success'], description: 'Policy performance protocol.', cluster: 'RL' },

  // Generative Models (GEN-*)
  'GEN-DIFF':   { label: 'DiffusionPipeline', icon: '🌫️', tags: ['UNet','scheduler'], description: 'Noise schedule and sampler config.', cluster: 'GEN' },
  'GEN-VAE':    { label: 'VAEModel', icon: '🧳', tags: ['latent','decoder'], description: 'Latent autoencoder for generation.', cluster: 'GEN' },
  'GEN-FLOW':   { label: 'FlowModel', icon: '💧', tags: ['normalizing-flow'], description: 'Invertible generative architecture.', cluster: 'GEN' },
  'GEN-COND':   { label: 'Conditioning', icon: '🎚️', tags: ['classifier-free','guidance'], description: 'Control signals for generation.', cluster: 'GEN' },
  'GEN-CTRL':   { label: 'ControlUnit', icon: '🎛️', tags: ['ControlNet','T2I-Adapter'], description: 'Structure-guided generation module.', cluster: 'GEN' },

  // Privacy & Security in ML (PRIV-*)
  'PRIV-DP':    { label: 'DifferentialPrivacy', icon: '🕳️', tags: ['ε','δ','clip-noise'], description: 'DP accounting and mechanisms.', cluster: 'PRIV' },
  'PRIV-FED':   { label: 'FederatedPlan', icon: '🛰️', tags: ['FedAvg','secure-agg'], description: 'Federated training topology.', cluster: 'PRIV' },
  'PRIV-RED':   { label: 'RedactionPolicy', icon: '🧽', tags: ['PII','TDM'], description: 'Pre/post-processing redaction rules.', cluster: 'PRIV' },
  'PRIV-MEM':   { label: 'MemLeakTest', icon: '🩸', tags: ['extraction','MIAs'], description: 'Membership and inversion audits.', cluster: 'PRIV' },
  'PRIV-IP':    { label: 'IPGuard', icon: '⚖️', tags: ['copyright','license'], description: 'Content licensing and usage constraints.', cluster: 'PRIV' },

  // AI Ethics & Governance (ETH-*)
  'ETH-PRIN':   { label: 'EthicsPrinciples', icon: '📜', tags: ['fairness','accountability'], description: 'Declared commitments and definitions.', cluster: 'ETH' },
  'ETH-IMPACT': { label: 'ImpactAssessment', icon: '📉', tags: ['risk','stakeholders'], description: 'Contextual risk and benefit analysis.', cluster: 'ETH' },
  'ETH-AUD':    { label: 'AuditTrail', icon: '🧾', tags: ['provenance','decisions'], description: 'Governance logs and evidence.', cluster: 'ETH' },
  'ETH-BIAS':   { label: 'BiasReport', icon: '⚖️', tags: ['demographic','performance'], description: 'Bias findings and mitigations.', cluster: 'ETH' },
  'ETH-COMP':   { label: 'CompliancePack', icon: '🗂️', tags: ['policy','law'], description: 'Binding controls to regulations.', cluster: 'ETH' },

  // Tokenization & Text Processing (TOK-*)
  'TOK-VOC':    { label: 'Vocabulary', icon: '📚', tags: ['BPE','Unigram','WordPiece'], description: 'Token set with merges and stats.', cluster: 'TOK' },
  'TOK-NORM':   { label: 'Normalizer', icon: '🧼', tags: ['unicode','case','nfkc'], description: 'Pre-tokenization normalization rules.', cluster: 'TOK' },
  'TOK-SPM':    { label: 'Segmenter', icon: '✂️', tags: ['sentence','word'], description: 'Text segmentation strategy.', cluster: 'TOK' },
  'TOK-ALIGN':  { label: 'TokenAlignment', icon: '🪢', tags: ['char↔token'], description: 'Mappings between text and tokens.', cluster: 'TOK' },
  'TOK-COST':   { label: 'TokenCostModel', icon: '💲', tags: ['throughput','latency'], description: 'Budgeting and pricing by token flow.', cluster: 'TOK' },
};
