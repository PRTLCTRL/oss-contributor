import { Octokit } from "@octokit/rest";
import { GITHUB_TOKEN, TARGET_REPOS, HANDPICKED_ISSUES, ISSUES_PER_REPO, type TargetRepo } from "./config.js";

export interface CandidateIssue {
  repo: TargetRepo;
  issueNumber: number;
  title: string;
  body: string;
  url: string;
  labels: string[];
}

const octokit = new Octokit({ auth: GITHUB_TOKEN || undefined });

async function fetchIssueDetails(repo: TargetRepo, issueNumber: number): Promise<CandidateIssue | null> {
  try {
    const { data: issue } = await octokit.issues.get({
      owner: repo.owner,
      repo: repo.repo,
      issue_number: issueNumber,
    });

    return {
      repo,
      issueNumber: issue.number,
      title: issue.title,
      body: issue.body || "",
      url: issue.html_url,
      labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name || "")),
    };
  } catch (error) {
    console.error(`  Failed to fetch ${repo.owner}/${repo.repo}#${issueNumber}:`, error);
    return null;
  }
}

async function discoverIssuesForRepo(repo: TargetRepo): Promise<CandidateIssue[]> {
  const candidates: CandidateIssue[] = [];
  const labelsToSearch = repo.labels.length > 0 ? repo.labels : ["bug", "help wanted", "good first issue"];

  for (const label of labelsToSearch) {
    try {
      const { data: issues } = await octokit.issues.listForRepo({
        owner: repo.owner,
        repo: repo.repo,
        labels: label,
        state: "open",
        sort: "created",
        direction: "desc",
        per_page: ISSUES_PER_REPO * 2,
      });

      for (const issue of issues) {
        if (issue.pull_request) continue;
        if (candidates.some((c) => c.issueNumber === issue.number)) continue;

        candidates.push({
          repo,
          issueNumber: issue.number,
          title: issue.title,
          body: issue.body || "",
          url: issue.html_url,
          labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name || "")),
        });

        if (candidates.length >= ISSUES_PER_REPO) break;
      }
    } catch {
      // label might not exist in this repo, skip
    }
  }

  if (candidates.length === 0) {
    try {
      const { data: issues } = await octokit.issues.listForRepo({
        owner: repo.owner,
        repo: repo.repo,
        state: "open",
        sort: "created",
        direction: "desc",
        per_page: ISSUES_PER_REPO * 3,
      });

      for (const issue of issues) {
        if (issue.pull_request) continue;
        if (isLikelyTractable(issue.title, issue.body || "")) {
          candidates.push({
            repo,
            issueNumber: issue.number,
            title: issue.title,
            body: issue.body || "",
            url: issue.html_url,
            labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name || "")),
          });
          if (candidates.length >= ISSUES_PER_REPO) break;
        }
      }
    } catch (error) {
      console.error(`  Failed to list issues for ${repo.owner}/${repo.repo}:`, error);
    }
  }

  return candidates.slice(0, ISSUES_PER_REPO);
}

function isLikelyTractable(title: string, body: string): boolean {
  const text = (title + " " + body).toLowerCase();

  const tooComplex = [
    "breaking change", "rfc", "redesign", "rewrite", "migration",
    "epic", "meta issue", "tracking issue", "roadmap",
    "infrastructure", "deploy", "ci/cd",
  ];
  if (tooComplex.some((signal) => text.includes(signal))) return false;

  const tractable = [
    "error", "bug", "fix", "crash", "incorrect", "wrong", "fails",
    "broken", "typo", "missing", "undefined", "null", "type error",
    "typeerror", "regression", "unexpected", "silent", "not working",
    "doesn't work", "should be", "should not",
  ];
  return tractable.some((signal) => text.includes(signal));
}

export async function findContributionTargets(): Promise<CandidateIssue[]> {
  const allCandidates: CandidateIssue[] = [];

  if (HANDPICKED_ISSUES.length > 0) {
    console.log(`Fetching ${HANDPICKED_ISSUES.length} handpicked issues...`);

    for (const picked of HANDPICKED_ISSUES) {
      const repo = TARGET_REPOS[picked.repoKey];
      if (!repo) {
        console.error(`  Unknown repo key: ${picked.repoKey}`);
        continue;
      }
      console.log(`  Fetching ${repo.owner}/${repo.repo}#${picked.issueNumber}...`);
      const issue = await fetchIssueDetails(repo, picked.issueNumber);
      if (issue) allCandidates.push(issue);
    }
  } else {
    console.log(`Auto-discovering issues across ${Object.keys(TARGET_REPOS).length} repos...`);

    for (const [key, repo] of Object.entries(TARGET_REPOS)) {
      console.log(`  Scanning ${repo.owner}/${repo.repo}...`);
      const issues = await discoverIssuesForRepo(repo);
      console.log(`    Found ${issues.length} tractable issues`);
      allCandidates.push(...issues);
    }
  }

  console.log(`\nTotal contribution targets: ${allCandidates.length}`);
  return allCandidates;
}
