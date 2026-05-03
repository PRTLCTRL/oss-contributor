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

const WORKFLOW_PROMPT = `Add a GitHub Actions workflow that automatically responds to PR review feedback using Cursor Cloud Agents.

Create the file .github/workflows/respond-to-feedback.yml with this exact content:

\`\`\`yaml
name: Respond to PR Feedback

on:
  pull_request_review:
    types: [submitted]
  issue_comment:
    types: [created]

jobs:
  respond:
    if: >
      (github.event_name == 'pull_request_review' &&
       github.event.review.state == 'changes_requested') ||
      (github.event_name == 'issue_comment' &&
       github.event.issue.pull_request &&
       !contains(github.event.comment.user.login, '[bot]') &&
       github.event.comment.user.login != '${FORK_OWNER}')
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v4
        with:
          ref: \${{ github.event.pull_request.head.ref || '' }}

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install Cursor SDK
        run: npm init -y && npm install @cursor/sdk @octokit/rest

      - name: Gather context and launch fix agent
        env:
          CURSOR_API_KEY: \${{ secrets.CURSOR_API_KEY }}
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: |
          node -e "
          const { Agent } = require('@cursor/sdk');
          const { Octokit } = require('@octokit/rest');

          async function main() {
            const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
            const repo = '\${{ github.repository }}'.split('/');
            const prNum = \${{ github.event.pull_request.number || github.event.issue.number }};
            const reviewer = '\${{ github.event.review.user.login || github.event.comment.user.login }}';
            const feedback = \`\${{ github.event.review.body || github.event.comment.body }}\`.slice(0, 3000);

            const { data: pr } = await octokit.pulls.get({ owner: repo[0], repo: repo[1], pull_number: prNum });
            const { data: reviewComments } = await octokit.pulls.listReviewComments({
              owner: repo[0], repo: repo[1], pull_number: prNum, per_page: 30
            });

            const reviewSummary = reviewComments
              .map(c => c.user.login + ' on ' + c.path + ':' + (c.line||c.original_line) + ': ' + c.body.slice(0, 400))
              .join('\\n\\n');

            const prompt = 'Address the PR review feedback.\\n\\n' +
              'PR: ' + pr.title + '\\nBranch: ' + pr.head.ref + '\\n\\n' +
              'Feedback from @' + reviewer + ':\\n' + feedback + '\\n\\n' +
              'All review comments:\\n' + reviewSummary + '\\n\\n' +
              'Fix what they asked for. Run tests. Commit as: address review: <summary>';

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

Commit this file with the message: "ci: add automated PR feedback responder via Cursor Cloud Agents"

Only create this one file. Do not modify anything else.`;

async function setupFeedbackWorkflows() {
  console.log("Setting up PR feedback responder on all forks...\n");

  const results = await Promise.allSettled(
    FORKS.map(async (fork) => {
      console.log(`  Launching setup for ${FORK_OWNER}/${fork.repo}...`);
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

setupFeedbackWorkflows().catch(console.error);
