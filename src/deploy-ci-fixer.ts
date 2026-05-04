import { Agent } from "@cursor/sdk";
import "dotenv/config";

const CURSOR_API_KEY = process.env.CURSOR_API_KEY!;
const FORK_OWNER = "PRTLCTRL";

const FORKS = [
  { repo: "dgraph", url: `https://github.com/${FORK_OWNER}/dgraph` },
  { repo: "ruflo", url: `https://github.com/${FORK_OWNER}/ruflo` },
  { repo: "graphify", url: `https://github.com/${FORK_OWNER}/graphify` },
  { repo: "tambo", url: `https://github.com/${FORK_OWNER}/tambo` },
];

const WORKFLOW_PROMPT = `Add a GitHub Actions workflow that automatically fixes CI failures on PRs using Cursor Cloud Agents.

Create the file .github/workflows/fix-ci-failures.yml with this exact content:

\`\`\`yaml
name: Auto-fix CI Failures

on:
  check_suite:
    types: [completed]
  workflow_run:
    workflows: ["*"]
    types: [completed]

jobs:
  fix-failures:
    if: >
      (github.event_name == 'check_suite' && github.event.check_suite.conclusion == 'failure') ||
      (github.event_name == 'workflow_run' && github.event.workflow_run.conclusion == 'failure')
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install Cursor SDK
        run: npm init -y && npm install @cursor/sdk @octokit/rest

      - name: Find failing PR and launch fix agent
        env:
          CURSOR_API_KEY: \${{ secrets.CURSOR_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          node -e "
          const { Agent } = require('@cursor/sdk');
          const { Octokit } = require('@octokit/rest');

          async function main() {
            const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
            const [owner, repo] = '\${{ github.repository }}'.split('/');

            // Find the PR associated with this check failure
            const headSha = '\${{ github.event.check_suite.head_sha || github.event.workflow_run.head_sha }}';
            if (!headSha) { console.log('No head SHA, skipping'); return; }

            const { data: prs } = await octokit.pulls.list({ owner, repo, state: 'open', per_page: 20 });
            const pr = prs.find(p => p.head.sha === headSha);
            if (!pr) { console.log('No open PR for this SHA, skipping'); return; }

            // Get failure details
            const { data: checks } = await octokit.checks.listForRef({ owner, repo, ref: headSha, per_page: 50 });
            const failures = checks.check_runs
              .filter(c => c.conclusion === 'failure')
              .map(c => c.name + ': ' + (c.output?.summary || 'failed').slice(0, 500))
              .join('\\n');

            if (!failures) { console.log('No failures found'); return; }

            console.log('Fixing PR #' + pr.number + ': ' + pr.title);
            console.log('Failures:\\n' + failures);

            const prompt = 'Fix the CI build failures on branch ' + pr.head.ref + '.\\n\\n' +
              'PR: ' + pr.title + '\\n\\n' +
              'Failed checks:\\n' + failures + '\\n\\n' +
              'Read the CI config, understand what failed, fix it, run the build/tests to confirm, ' +
              'and commit as: fix: resolve CI failures';

            const result = await Agent.prompt(prompt, {
              apiKey: process.env.CURSOR_API_KEY,
              cloud: {
                repos: [{ url: 'https://github.com/\${{ github.repository }}' }],
                autoCreatePR: false,
                skipReviewerRequest: true,
              },
            });
            console.log('Agent:', result.status, result.id);
          }

          main().catch(e => { console.error(e); process.exit(1); });
          "
\`\`\`

Commit this file with the message: "ci: add automated CI failure fixer via Cursor Cloud Agents"

Only create this one file. Do not modify anything else.`;

async function deployToForks() {
  console.log("Deploying CI failure fixer to all forks...\n");

  const results = await Promise.allSettled(
    FORKS.map(async (fork) => {
      console.log(`  Deploying to ${FORK_OWNER}/${fork.repo}...`);
      try {
        const result = await Agent.prompt(WORKFLOW_PROMPT, {
          apiKey: CURSOR_API_KEY,
          cloud: {
            repos: [{ url: fork.url }],
            autoCreatePR: false,
            skipReviewerRequest: true,
          },
        });
        console.log(`  ✓ ${fork.repo}: ${result.status} (${result.id})`);
        return result;
      } catch (error: any) {
        console.error(`  ✗ ${fork.repo}:`, error?.message || error);
        throw error;
      }
    })
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  console.log(`\nDone: ${succeeded}/${FORKS.length} forks configured.`);
}

deployToForks().catch(console.error);
