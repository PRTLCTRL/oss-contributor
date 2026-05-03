import "dotenv/config";

export const CURSOR_API_KEY = process.env.CURSOR_API_KEY!;
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

export interface TargetRepo {
  owner: string;
  repo: string;
  url: string;
  labels: string[];
  language: string;
  contributionGuide?: string;
}

export const TARGET_REPOS: TargetRepo[] = [
  {
    owner: "vercel",
    repo: "ai",
    url: "https://github.com/vercel/ai",
    labels: ["bug"],
    language: "TypeScript",
    contributionGuide: "Follow the existing code patterns. Run pnpm install && pnpm build && pnpm test.",
  },
  {
    owner: "langchain-ai",
    repo: "langchainjs",
    url: "https://github.com/langchain-ai/langchainjs",
    labels: ["bug"],
    language: "TypeScript",
    contributionGuide: "Use yarn. Check the relevant package under libs/. Run yarn build && yarn test in the affected package.",
  },
  {
    owner: "modelcontextprotocol",
    repo: "typescript-sdk",
    url: "https://github.com/modelcontextprotocol/typescript-sdk",
    labels: ["bug", "good first issue"],
    language: "TypeScript",
    contributionGuide: "Run npm install && npm run build && npm test.",
  },
  {
    owner: "supabase",
    repo: "supabase",
    url: "https://github.com/supabase/supabase",
    labels: ["bug", "good first issue"],
    language: "TypeScript",
    contributionGuide: "Monorepo. Identify the affected package under apps/ or packages/. Follow CONTRIBUTING.md.",
  },
];

export const MAX_CONCURRENT_AGENTS = 3;
export const ISSUES_PER_REPO = 2;
