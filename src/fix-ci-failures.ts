import { Agent } from "@cursor/sdk";
import { Octokit } from "@octokit/rest";
import "dotenv/config";

const CURSOR_API_KEY = process.env.CURSOR_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const FORK_OWNER = "PRTLCTRL";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

interface FailingPR {
  repo: string;
  forkUrl: string;
  prNumber: number;
  title: string;
  headRef: string;
  failedChecks: string[];
}

async function findFailingPRs(): Promise<FailingPR[]> {
  const repos = [
    { name: "ruflo", owner: "PRTLCTRL", forkUrl: `https://github.com/${FORK_OWNER}/ruflo` },
    { name: "dgraph", owner: "PRTLCTRL", forkUrl: `https://github.com/${FORK_OWNER}/dgraph` },
    { name: "graphify", owner: "PRTLCTRL", forkUrl: `https://github.com/${FORK_OWNER}/graphify` },
    { name: "tambo", owner: "PRTLCTRL", forkUrl: `https://github.com/${FORK_OWNER}/tambo` },
  ];

  const failing: FailingPR[] = [];

  for (const repo of repos) {
    const { data: prs } = await octokit.pulls.list({
      owner: repo.owner,
      repo: repo.name,
      state: "open",
      per_page: 20,
    });

    for (const pr of prs) {
      const { data: checks } = await octokit.checks.listForRef({
        owner: repo.owner,
        repo: repo.name,
        ref: pr.head.sha,
        per_page: 50,
      });

      const failed = checks.check_runs.filter((c) => c.conclusion === "failure");
      if (failed.length > 0) {
        failing.push({
          repo: repo.name,
          forkUrl: repo.forkUrl,
          prNumber: pr.number,
          title: pr.title,
          headRef: pr.head.ref,
          failedChecks: failed.map((c) => `${c.name}: ${c.output?.summary?.slice(0, 300) || "no summary"}`),
        });
      }
    }
  }

  return failing;
}

async function fetchCheckLogs(repo: string, prNumber: number): Promise<string> {
  try {
    const { data: pr } = await octokit.pulls.get({
      owner: FORK_OWNER, repo, pull_number: prNumber,
    });

    const { data: checks } = await octokit.checks.listForRef({
      owner: FORK_OWNER, repo, ref: pr.head.sha, per_page: 50,
    });

    const failures = checks.check_runs
      .filter((c) => c.conclusion === "failure")
      .map((c) => `### ${c.name}\n${c.output?.text?.slice(0, 2000) || c.output?.summary?.slice(0, 1000) || "No output available"}`)
      .join("\n\n");

    return failures || "No failure details available";
  } catch {
    return "Could not fetch check logs";
  }
}

async function fixFailingPR(pr: FailingPR): Promise<void> {
  console.log(`  Fixing ${pr.repo}#${pr.prNumber}: ${pr.title.slice(0, 50)}...`);

  const logs = await fetchCheckLogs(pr.repo, pr.prNumber);

  const prompt = `You are fixing a failing CI build on PR #${pr.prNumber} in ${FORK_OWNER}/${pr.repo}.

## PR: ${pr.title}
Branch: ${pr.headRef}

## CI Failures

${pr.failedChecks.join("\n\n")}

## Failure Logs

${logs.slice(0, 5000)}

## Instructions

1. Check out the branch ${pr.headRef}
2. Read the CI failure logs carefully — understand exactly what's failing
3. Look at the CI workflow files (.github/workflows/) to understand what commands run
4. Fix the build/test failures. Common causes:
   - Missing dependencies
   - Type errors
   - Test failures from the changes made
   - Linting errors
   - Import errors
5. Run the build and tests locally to confirm they pass
6. Commit with a message like "fix: resolve CI failures — <brief description>"

## Rules
- Only fix what's broken. Don't refactor or add features.
- If the CI failure is from an upstream issue (not caused by this PR's changes), note it in a commit message but don't try to fix unrelated code.`;

  try {
    const result = await Agent.prompt(prompt, {
      apiKey: CURSOR_API_KEY,
      cloud: {
        repos: [{ url: pr.forkUrl }],
        autoCreatePR: false,
        skipReviewerRequest: true,
      },
    });
    console.log(`  ✓ ${pr.repo}#${pr.prNumber}: ${result.status} (${result.id})`);
  } catch (error: any) {
    console.error(`  ✗ ${pr.repo}#${pr.prNumber}:`, error?.message || error);
  }
}

async function main() {
  console.log("=== CI Failure Fixer ===\n");

  const failing = await findFailingPRs();
  console.log(`Found ${failing.length} PRs with failing builds.\n`);

  if (failing.length === 0) {
    console.log("All green. Nothing to fix.");
    return;
  }

  for (const pr of failing) {
    console.log(`  ${pr.repo}#${pr.prNumber}: ${pr.title}`);
    console.log(`    Failed: ${pr.failedChecks.length} check(s)`);
  }

  console.log(`\nLaunching fix agents (max 4 parallel)...\n`);

  const batches: FailingPR[][] = [];
  for (let i = 0; i < failing.length; i += 4) {
    batches.push(failing.slice(i, i + 4));
  }

  for (const batch of batches) {
    await Promise.allSettled(batch.map((pr) => fixFailingPR(pr)));
  }

  console.log("\nDone.");
}

main().catch(console.error);
