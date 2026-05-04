import { Agent } from "@cursor/sdk";
import { Octokit } from "@octokit/rest";
import "dotenv/config";

const CURSOR_API_KEY = process.env.CURSOR_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const FORK_OWNER = "PRTLCTRL";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

const REPOS = [
  { name: "ruflo", url: `https://github.com/${FORK_OWNER}/ruflo` },
  { name: "dgraph", url: `https://github.com/${FORK_OWNER}/dgraph` },
  { name: "graphify", url: `https://github.com/${FORK_OWNER}/graphify` },
  { name: "tambo", url: `https://github.com/${FORK_OWNER}/tambo` },
];

async function rewritePRsForRepo(repo: { name: string; url: string }) {
  const { data: prs } = await octokit.pulls.list({
    owner: FORK_OWNER,
    repo: repo.name,
    state: "open",
    per_page: 20,
  });

  if (prs.length === 0) {
    console.log(`  ${repo.name}: no open PRs`);
    return;
  }

  const prList = prs.map((pr) => `- PR #${pr.number}: "${pr.title}" (branch: ${pr.head.ref})`).join("\n");

  console.log(`  ${repo.name}: rewriting ${prs.length} PRs...`);

  const prompt = `You need to rewrite the descriptions of ALL open pull requests in this repo to sound more human, humble, and engaging.

## Open PRs to rewrite:
${prList}

## For EACH PR above, do the following:

1. Read the PR's diff to understand what actually changed
2. Use the GitHub CLI (\`gh pr edit <number> --body "..."\`) to update the description
3. Write each description in this style:

### Tone guidelines:
- You're a developer getting more involved with this project, not a robot
- Be specific about what you actually tested. If you ran tests, say which ones. If you couldn't run something, say why
- Don't claim "all tests pass" or "comprehensive test coverage" unless you literally verified it
- Be honest about limitations: "I wasn't able to test X because Y"
- Add a touch of personality — one light observation or self-aware comment is fine
- End with something inviting: "Would love feedback on this approach" or "Happy to adjust if this isn't the right direction"
- Reference the issue naturally, not robotically
- Keep it concise — 3-5 short paragraphs max

### Example of good PR description:
\`\`\`
Tackles #1234.

The parser was bailing on lazy-loaded commands before it ever looked at their subcommands, so short flags like \`-t\` were silently ignored even though the help text advertised them. Kind of a "we'll handle it later" that never got handled.

The fix adds a second pass that resolves subcommand flags after lazy loading completes. I also added a test case for the \`-t\` and \`-c\` flags specifically.

**What I tested:** Ran \`npm test\` locally — the existing suite plus the new test all pass. I didn't test against a live Claude Code session since that needs the full daemon running, so would appreciate a sanity check there.

Trying to get more involved with this project — happy to iterate if anything looks off.
\`\`\`

### Example of BAD PR description (what we're replacing):
\`\`\`
## Summary
This PR fixes issue #1234 by implementing the correct behavior.

## Changes
- Modified parser.js to handle lazy commands
- Added comprehensive tests

## Testing
All existing tests pass. New tests added for complete coverage.
\`\`\`

## Important
- Rewrite ALL ${prs.length} PRs, not just one
- Use \`gh pr edit <number> --body "..."\` for each one
- Read the actual diff first so the description is accurate
- Do NOT change any code, only PR descriptions`;

  try {
    const result = await Agent.prompt(prompt, {
      apiKey: CURSOR_API_KEY,
      cloud: {
        repos: [{ url: repo.url }],
        autoCreatePR: false,
        skipReviewerRequest: true,
      },
    });
    console.log(`  ✓ ${repo.name}: ${result.status} (${result.id})`);
  } catch (error: any) {
    console.error(`  ✗ ${repo.name}:`, error?.message || error);
  }
}

async function main() {
  console.log("=== PR Description Rewriter ===\n");

  await Promise.allSettled(REPOS.map((repo) => rewritePRsForRepo(repo)));

  console.log("\nDone.");
}

main().catch(console.error);
