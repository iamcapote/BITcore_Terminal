# Bitcore Nova GUI

Bitcore Nova is the next-generation, modular IDE-like GUI for BITcore. It consolidates prior GUI experiments into a single, canonical app.

## Run locally

From the repo root:

```bash
npm run nova:dev
```

Or directly from the app folder:

```bash
cd app/nova
npm run dev
```

Build and preview:

```bash
npm run nova:build
npm run nova:preview
```

## Tech stack
- Vite + React + TypeScript
- TailwindCSS (with shadcn/ui design tokens)
- Radix UI primitives via shadcn/ui components

## Status
- Canonical GUI directory: `app/nova/`
- The legacy UI (root-level Vite setup) remains for reference and can be deprecated after Nova reaches parity.
- The `app/nova-ide/` folder is empty and can be safely removed.

## Notes
Tailwind is configured with shadcn color tokens in `tailwind.config.cjs`. Global CSS tokens live in `src/index.css`.
