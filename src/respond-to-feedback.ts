import { Agent } from "@cursor/sdk";
import { Octokit } from "@octokit/rest";
import "dotenv/config";

const CURSOR_API_KEY = process.env.CURSOR_API_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const PR_NUMBER = parseInt(process.env.PR_NUMBER || "0");
const PR_REPO = process.env.PR_REPO || "";
const REVIEW_BODY = process.env.REVIEW_BODY || "";
const REVIEWER = process.env.REVIEWER || "";

const FORK_OWNER = "PRTLCTRL";

const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function gatherPRContext(): Promise<{
  title: string;
  body: string;
  headRef: string;
  comments: string;
  reviewComments: string;
  forkUrl: string;
}> {
  const [owner, repo] = PR_REPO.split("/");

  const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: PR_NUMBER });

  const { data: comments } = await octokit.issues.listComments({
    owner, repo, issue_number: PR_NUMBER, per_page: 20,
  });

  const { data: reviewComments } = await octokit.pulls.listReviewComments({
    owner, repo, pull_number: PR_NUMBER, per_page: 30,
  });

  const commentsSummary = comments
    .map((c) => `@${c.user?.login}: ${c.body?.slice(0, 500)}`)
    .join("\n\n");

  const reviewSummary = reviewComments
    .map((c) => `@${c.user?.login} on ${c.path}:${c.line || c.original_line}:\n${c.body?.slice(0, 500)}`)
    .join("\n\n");

  return {
    title: pr.title,
    body: pr.body || "",
    headRef: pr.head.ref,
    comments: commentsSummary,
    reviewComments: reviewSummary,
    forkUrl: `https://github.com/${FORK_OWNER}/${repo}`,
  };
}

async function respondToFeedback() {
  if (!PR_NUMBER || !PR_REPO) {
    console.log("Missing PR_NUMBER or PR_REPO, skipping.");
    return;
  }

  if (REVIEWER === "github-actions[bot]" || REVIEWER === FORK_OWNER) {
    console.log("Ignoring bot or self comment.");
    return;
  }

  console.log(`Responding to feedback on ${PR_REPO}#${PR_NUMBER} from @${REVIEWER}`);

  const context = await gatherPRContext();

  const prompt = `You are fixing PR feedback on an open source contribution.

## Context

**PR #${PR_NUMBER}: ${context.title}**
${context.body.slice(0, 2000)}

**Branch:** ${context.headRef}

## Feedback to address

**From @${REVIEWER}:**
${REVIEW_BODY.slice(0, 3000)}

## All review comments on this PR

${context.reviewComments.slice(0, 4000)}

## General comments

${context.comments.slice(0, 2000)}

## Instructions

1. Read ALL the feedback carefully — understand what the reviewer is asking for
2. Find the relevant files and make the requested changes
3. If the reviewer pointed out a bug in your fix, fix it properly
4. If they asked for tests, add them
5. If they asked for style changes, make them
6. Run the project's tests to make sure everything still passes
7. Commit with a message like "address review: <what you changed>"

## Voice

Be a real person in commit messages. Brief, clear, maybe a touch of personality. Not corporate.

## Rules

- Only change what the reviewer asked about
- Don't introduce new features or refactors
- If a request is unclear, make your best judgment and note it in the commit message`;

  try {
    const result = await Agent.prompt(prompt, {
      apiKey: CURSOR_API_KEY,
      cloud: {
        repos: [{ url: context.forkUrl }],
        autoCreatePR: false,
        skipReviewerRequest: true,
      },
    });

    console.log(`Agent finished: status=${result.status}, id=${result.id}`);
  } catch (error: any) {
    console.error("Agent failed:", error?.message || error);
  }
}

respondToFeedback().catch((error) => {
  console.error("Fatal:", error);
  process.exit(1);
});
