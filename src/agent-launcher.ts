import { Agent } from "@cursor/sdk";
import { CURSOR_API_KEY, MAX_CONCURRENT_AGENTS } from "./config.js";
import type { CandidateIssue } from "./issue-finder.js";

interface AgentRun {
  issue: CandidateIssue;
  agentId: string;
  status: "running" | "finished" | "error";
  prUrl?: string;
}

function buildPromptForIssue(issue: CandidateIssue): string {
  const repoSlug = `${issue.repo.owner}/${issue.repo.repo}`;

  return `You are contributing to the open source project ${repoSlug}.

## Your task

Fix the following GitHub issue and open a pull request:

**Issue #${issue.issueNumber}: ${issue.title}**
URL: ${issue.url}

**Issue description:**
${issue.body.slice(0, 4000)}

## Instructions

1. **Understand the issue thoroughly.** Read the issue description, understand the expected vs actual behavior, and identify the root cause.

2. **Find the relevant code.** Search the codebase for the files and functions related to this bug. Read them carefully.

3. **Implement the fix.** Make the minimal, targeted change needed to fix the issue. Do NOT refactor unrelated code. Follow the project's existing code style exactly.

4. **Write or update tests.** If the project has tests, add a test case that would have caught this bug. Run the existing test suite to make sure nothing breaks.

5. **Build the project.** Run the build command to ensure your changes compile.
${issue.repo.contributionGuide ? `\n6. **Project-specific guidance:** ${issue.repo.contributionGuide}` : ""}

## PR Guidelines

- Title: "fix: <concise description>" matching the project's convention
- Body: Reference the issue with "Fixes #${issue.issueNumber}" so it auto-closes
- Keep the diff small and focused. One issue = one fix.
- Do NOT add unrelated changes, formatting fixes, or dependency bumps.

## Quality bar

Your PR should be merge-ready. Maintainers should be able to review and merge it without asking for changes. If you cannot confidently fix this issue after investigation, explain why in a comment on the PR rather than submitting broken code.`;
}

async function launchAgentForIssue(issue: CandidateIssue): Promise<AgentRun> {
  const repoSlug = `${issue.repo.owner}/${issue.repo.repo}`;
  const prompt = buildPromptForIssue(issue);

  console.log(`  Launching agent for ${repoSlug}#${issue.issueNumber}: ${issue.title.slice(0, 60)}...`);

  try {
    const result = await Agent.prompt(prompt, {
      apiKey: CURSOR_API_KEY,
      cloud: {
        repos: [{ url: issue.repo.url }],
        autoCreatePR: true,
        skipReviewerRequest: true,
      },
    });

    if (result.status === "finished") {
      console.log(`  ✓ Agent finished for ${repoSlug}#${issue.issueNumber} (agent: ${result.id})`);
      return { issue, agentId: result.id, status: "finished" };
    } else {
      console.error(`  ✗ Agent failed for ${repoSlug}#${issue.issueNumber}: status=${result.status}`);
      return { issue, agentId: result.id, status: "error" };
    }
  } catch (error: any) {
    console.error(`  ✗ Agent startup failed for ${repoSlug}#${issue.issueNumber}:`, error?.message || error);
    return { issue, agentId: "unknown", status: "error" };
  }
}

export async function launchAgents(issues: CandidateIssue[]): Promise<AgentRun[]> {
  const results: AgentRun[] = [];
  const batches: CandidateIssue[][] = [];

  for (let i = 0; i < issues.length; i += MAX_CONCURRENT_AGENTS) {
    batches.push(issues.slice(i, i + MAX_CONCURRENT_AGENTS));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`\nBatch ${batchIndex + 1}/${batches.length} (${batch.length} agents):`);

    const batchResults = await Promise.allSettled(
      batch.map((issue) => launchAgentForIssue(issue))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        console.error("  ✗ Unexpected batch error:", result.reason);
      }
    }
  }

  return results;
}
