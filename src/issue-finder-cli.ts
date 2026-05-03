import { findContributionTargets } from "./issue-finder.js";

async function previewIssues() {
  const issues = await findContributionTargets();

  if (issues.length === 0) {
    console.log("No issues found.");
    return;
  }

  console.log("\n--- Issues that will be targeted ---\n");
  for (const issue of issues) {
    console.log(`[${issue.repo.owner}/${issue.repo.repo}#${issue.issueNumber}] (${issue.repo.language})`);
    console.log(`  Title:  ${issue.title}`);
    console.log(`  URL:    ${issue.url}`);
    console.log(`  Labels: ${issue.labels.join(", ") || "(none)"}`);
    console.log();
  }
}

previewIssues().catch(console.error);
