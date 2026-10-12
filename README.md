This is the [assistant-ui](https://github.com/assistant-ui/assistant-ui) starter project.

## Getting Started

First, add your [Groq API key](https://console.groq.com/keys) to `.env.local` file:

```
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Then start the LangGraph agent server (serves `agent/graph.ts` on http://localhost:2024):

```bash
npm run agent
```

In another terminal, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.
