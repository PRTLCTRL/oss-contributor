import { Octokit } from "@octokit/rest";
import { GITHUB_TOKEN, TARGET_REPOS, ISSUES_PER_REPO, type TargetRepo } from "./config.js";

export interface CandidateIssue {
  repo: TargetRepo;
  issueNumber: number;
  title: string;
  body: string;
  url: string;
  labels: string[];
}

const octokit = new Octokit({ auth: GITHUB_TOKEN || undefined });

async function fetchIssuesForRepo(repo: TargetRepo): Promise<CandidateIssue[]> {
  const candidates: CandidateIssue[] = [];

  for (const label of repo.labels) {
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

        const alreadyTracked = candidates.some((c) => c.issueNumber === issue.number);
        if (alreadyTracked) continue;

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
    } catch (error) {
      console.error(`Failed to fetch issues for ${repo.owner}/${repo.repo} (label: ${label}):`, error);
    }
  }

  return candidates.slice(0, ISSUES_PER_REPO);
}

function isLikelyFixable(issue: CandidateIssue): boolean {
  const bodyLower = (issue.body + " " + issue.title).toLowerCase();

  const unfixableSignals = [
    "breaking change",
    "rfc",
    "proposal",
    "design doc",
    "roadmap",
    "epic",
    "meta issue",
    "tracking issue",
    "discussion",
  ];
  if (unfixableSignals.some((signal) => bodyLower.includes(signal))) return false;

  const fixableSignals = [
    "error",
    "bug",
    "fix",
    "crash",
    "incorrect",
    "wrong",
    "fails",
    "broken",
    "typo",
    "missing",
    "undefined",
    "null",
    "type error",
    "typeerror",
    "regression",
    "unexpected",
  ];
  return fixableSignals.some((signal) => bodyLower.includes(signal));
}

export async function findContributionTargets(): Promise<CandidateIssue[]> {
  console.log(`Scanning ${TARGET_REPOS.length} repos for contribution targets...`);

  const allCandidates: CandidateIssue[] = [];

  for (const repo of TARGET_REPOS) {
    console.log(`  Scanning ${repo.owner}/${repo.repo}...`);
    const issues = await fetchIssuesForRepo(repo);
    const fixable = issues.filter(isLikelyFixable);
    console.log(`    Found ${issues.length} issues, ${fixable.length} look fixable`);
    allCandidates.push(...fixable);
  }

  console.log(`\nTotal fixable candidates: ${allCandidates.length}`);
  return allCandidates;
}
