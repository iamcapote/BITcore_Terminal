# Deep Research Privacy App Refactor

This document outlines the steps to refactor the existing Deep Research Privacy app into a modular structure using **Node.js**, **Express**, and **ES Modules (.mjs)**. The refactor will reorganize the app into a scalable and maintainable structure while preserving the current functionality.

---

## Proposed File Structure

```plaintext
app/
├── README.md                # Documentation for the app
├── config/                  # Configuration files
│   ├── config.mjs           # App-wide configuration
│   └── config_readme.md     # Documentation for configuration
├── features/                # Core features of the app
│   ├── cli/                 # CLI feature (if applicable)
│   │   ├── index.mjs        # Entry point for CLI
│   │   └── run.mjs          # CLI logic
├── infrastructure/          # Infrastructure modules
│   ├── ai/                  # AI infrastructure (Venice)
│   │   ├── llm-client.mjs   # Venice API client
│   │   ├── models.mjs       # Venice model configurations
│   │   └── providers.mjs    # Venice provider logic
│   ├── search/              # Search infrastructure (Brave)
│   │   ├── providers.mjs    # Brave API client
│   └── research/            # Research infrastructure
│       ├── research-engine.mjs # Core research engine
│       └── research-path.mjs   # Research path logic
├── plugins/                 # Plugin system for optional expansions
├── utils/                   # Utility functions
│   ├── rate-limiter.mjs     # Rate limiter utility
│   ├── object-utils.mjs     # General object utilities
│   └── systemStats.mjs      # System stats utilities
├── tests/                   # Test cases
│   ├── research.service.spec.mjs # Tests for research service
│   ├── brave.service.spec.mjs    # Tests for Brave plugin
│   └── venice.service.spec.mjs   # Tests for Venice plugin
└── start.mjs                # App entry point
```

---

## Steps to Refactor

### 1. Clone the Repository
1. Create a new folder for the refactored app:
   ```bash
   mkdir app && cd app
   ```
2. Clone the existing repository into the `app/` folder:
   ```bash
   git clone https://github.com/YOUR_USERNAME/deep-research-privacy.git .
   ```

---

### 2. Convert to ES Modules (.mjs)
1. Rename all `.ts` and `.js` files to `.mjs`.
2. Update `package.json` to set `"type": "module"`:
   ```json
   {
     "type": "module"
   }
   ```
3. Update all `import` and `export` statements to use `.mjs` extensions for local files.

---

### 3. Introduce Express Server
1. Create a `start.mjs` file in the root directory to initialize the Express server:
   ```javascript
   import express from 'express';
   import researchRoutes from './src/infrastructure/research/research-engine.mjs';

   const app = express();
   app.use(express.json());

   // Register routes
   app.use('/api/research', researchRoutes);

   const PORT = process.env.PORT || 3000;
   app.listen(PORT, () => {
     console.log(`Server running on http://localhost:${PORT}`);
   });
   ```

---

### 4. Relocate Infrastructure Files
1. Move **Venice AI logic** (`llm-client.ts`) to `infrastructure/ai/llm-client.mjs`.
2. Move **Brave Search logic** (`providers.ts`) to `infrastructure/search/providers.mjs`.
3. Move **Research logic** (`research-path.ts`, `deep-research.ts`) to `infrastructure/research/`.

---

### 5. Modularize Features
1. Create a `features/` folder for CLI or other user-facing features.
2. Move `run.ts` logic into `features/cli/run.mjs`.

---

### 6. Add Plugins (Optional)
1. Create a `plugins/` folder for optional expansions (e.g., new search providers or AI models).
2. Add new plugins as needed.

---

### 7. Testing
1. Create a `tests/` folder for unit and integration tests.
2. Write test cases for:
   - Research engine
   - Brave Search API
   - Venice AI API

---

## Infrastructure: The Three Pillars

### 1. AI Infrastructure (Venice)
- Handles AI-related tasks like query expansion and summarization.
- Example: `infrastructure/ai/llm-client.mjs`.

### 2. Search Infrastructure (Brave)
- Handles search-related tasks like querying Brave Search.
- Example: `infrastructure/search/providers.mjs`.

### 3. Research Infrastructure
- Orchestrates AI and search to perform deep research.
- Example: `infrastructure/research/research-engine.mjs`.

---
