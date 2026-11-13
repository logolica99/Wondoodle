# Wondoodle — Smart Canvas

A multimodal AI learning platform foundation. Feature 1 provides a polished, fully local Smart Canvas for drawing, writing, uploading images, organizing work, autosaving, and exporting. Feature 2 adds Pip, a live voice learning companion.

## Stack

- Next.js App Router (React + TypeScript)
- Tailwind CSS + shadcn/ui-style controls
- React Konva for canvas rendering
- Zustand for state
- Dexie / IndexedDB for persistence
- Motion for subtle UI animation
- Playwright for end-to-end tests
- OpenAI Realtime API (WebRTC) for Talk to Pip

## Getting started

```bash
npm install
cp .env.example .env   # add OPENAI_API_KEY for Talk / transcribe
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run test:e2e` | Playwright end-to-end tests |

## Brand

Logo assets live in `media/` (source) and `public/brand/` (served).
