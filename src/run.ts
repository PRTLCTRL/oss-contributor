import { findContributionTargets } from "./issue-finder.js";
import { launchAgents } from "./agent-launcher.js";

async function run() {
  console.log("=== OSS Contributor - Automated Open Source Contributions ===\n");
  console.log(`Started at ${new Date().toISOString()}\n`);

  const issues = await findContributionTargets();

  if (issues.length === 0) {
    console.log("No fixable issues found this run. Exiting.");
    return;
  }

  console.log(`\nLaunching agents for ${issues.length} issues...\n`);
  const results = await launchAgents(issues);

  const succeeded = results.filter((r) => r.status === "finished");
  const failed = results.filter((r) => r.status === "error");

  console.log("\n=== Run Summary ===");
  console.log(`Total issues found: ${issues.length}`);
  console.log(`Agents launched: ${results.length}`);
  console.log(`Succeeded: ${succeeded.length}`);
  console.log(`Failed: ${failed.length}`);

  if (succeeded.length > 0) {
    console.log("\nSuccessful contributions:");
    for (const run of succeeded) {
      console.log(`  - ${run.issue.repo.owner}/${run.issue.repo.repo}#${run.issue.issueNumber}: ${run.issue.title}`);
      console.log(`    Agent ID: ${run.agentId}`);
    }
  }

  if (failed.length > 0) {
    console.log("\nFailed attempts:");
    for (const run of failed) {
      console.log(`  - ${run.issue.repo.owner}/${run.issue.repo.repo}#${run.issue.issueNumber}: ${run.issue.title}`);
    }
  }

  console.log(`\nFinished at ${new Date().toISOString()}`);
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
