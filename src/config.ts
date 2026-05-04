import "dotenv/config";

export const CURSOR_API_KEY = process.env.CURSOR_API_KEY!;
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
export const FORK_OWNER = "PRTLCTRL";

export interface TargetRepo {
  owner: string;
  repo: string;
  forkUrl: string;
  upstreamUrl: string;
  labels: string[];
  language: string;
  testCommand: string;
  buildCommand: string;
  contributionGuide: string;
}

export interface HandpickedIssue {
  repoKey: string;
  issueNumber: number;
}

export const TARGET_REPOS: Record<string, TargetRepo> = {
  dgraph: {
    owner: "dgraph-io",
    repo: "dgraph",
    forkUrl: `https://github.com/${FORK_OWNER}/dgraph`,
    upstreamUrl: "https://github.com/dgraph-io/dgraph",
    labels: ["bug"],
    language: "Go",
    testCommand: "go test ./...",
    buildCommand: "make build",
    contributionGuide: `Go project. Use 'make build' to build and 'go test ./...' to test.
Read CONTRIBUTING.md if it exists. Follow existing code patterns strictly.
Dgraph uses Ristretto for caching, Badger for storage. Tests use testify.`,
  },
  ruflo: {
    owner: "ruvnet",
    repo: "ruflo",
    forkUrl: `https://github.com/${FORK_OWNER}/ruflo`,
    upstreamUrl: "https://github.com/ruvnet/ruflo",
    labels: [],
    language: "TypeScript",
    testCommand: "npm test",
    buildCommand: "npm run build",
    contributionGuide: `TypeScript/Node.js CLI tool. Run 'npm install' then 'npm run build' then 'npm test'.
This is a CLI tool (previously called claude-flow). Check package.json for available scripts.
Look at existing test patterns before writing tests.`,
  },
  graphify: {
    owner: "safishamsi",
    repo: "graphify",
    forkUrl: `https://github.com/${FORK_OWNER}/graphify`,
    upstreamUrl: "https://github.com/safishamsi/graphify",
    labels: [],
    language: "Python",
    testCommand: "pytest",
    buildCommand: "pip install -e .",
    contributionGuide: `Python project. Default branch is 'v6'. Install with 'pip install -e .' or 'pip install -e ".[dev]"'.
Run tests with pytest. Follow PEP 8. Check for pyproject.toml or setup.cfg for project config.
This is an AI coding assistant skill that builds knowledge graphs from code.`,
  },
  tambo: {
    owner: "tambo-ai",
    repo: "tambo",
    forkUrl: `https://github.com/${FORK_OWNER}/tambo`,
    upstreamUrl: "https://github.com/tambo-ai/tambo",
    labels: [],
    language: "TypeScript",
    testCommand: "npm test",
    buildCommand: "npm run build",
    contributionGuide: `TypeScript monorepo (Generative UI SDK for React). Check packages/ directory structure.
Likely uses turborepo or similar. Run 'npm install' at root, then 'npm run build'.
For tests, check each package's package.json for test scripts.
Key packages: packages/client (TamboClient, MCP), packages/react (React hooks).`,
  },
};

// Wave 4 issues
export const HANDPICKED_ISSUES: HandpickedIssue[] = [
  { repoKey: "ruflo", issueNumber: 1652 },   // AB test executor can't swap CLAUDE.md
  { repoKey: "ruflo", issueNumber: 1608 },   // security: tar CVEs via bcrypt chain
  { repoKey: "ruflo", issueNumber: 1504 },   // 106 agent definitions = 300K token bloat
  { repoKey: "tambo", issueNumber: 988 },    // streaming status for nested objects/arrays
  { repoKey: "tambo", issueNumber: 991 },    // auto interactables toggle on TamboProvider
  { repoKey: "dgraph", issueNumber: 9687 },  // "invalid cond value" parsing regression
  { repoKey: "dgraph", issueNumber: 9422 },  // duplicate JSON fields in mutations
  { repoKey: "graphify", issueNumber: 536 },  // support unique output directories
];

export const MAX_CONCURRENT_AGENTS = 4;
export const ISSUES_PER_REPO = 2;
