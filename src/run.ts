import { findContributionTargets } from "./issue-finder.js";
import { launchAgents } from "./agent-launcher.js";

async function run() {
  console.log("=== OSS Contributor ===\n");
  console.log(`Started at ${new Date().toISOString()}`);
  console.log(`Fork owner: PRTLCTRL\n`);

  const issues = await findContributionTargets();

  if (issues.length === 0) {
    console.log("No issues to work on. Exiting.");
    return;
  }

  console.log(`\nLaunching agents for ${issues.length} issues (max 4 parallel)...\n`);
  const results = await launchAgents(issues);

  const succeeded = results.filter((r) => r.status === "finished");
  const failed = results.filter((r) => r.status === "error");

  console.log("\n=== Summary ===");
  console.log(`Issues targeted: ${issues.length}`);
  console.log(`Agents completed: ${succeeded.length}`);
  console.log(`Agents failed: ${failed.length}`);

  if (succeeded.length > 0) {
    console.log("\nCompleted:");
    for (const agentRun of succeeded) {
      console.log(`  ✓ ${agentRun.issue.repo.owner}/${agentRun.issue.repo.repo}#${agentRun.issue.issueNumber}`);
      console.log(`    ${agentRun.issue.title}`);
      console.log(`    Agent: ${agentRun.agentId}`);
    }
  }

  if (failed.length > 0) {
    console.log("\nFailed:");
    for (const agentRun of failed) {
      console.log(`  ✗ ${agentRun.issue.repo.owner}/${agentRun.issue.repo.repo}#${agentRun.issue.issueNumber}`);
      console.log(`    ${agentRun.issue.title}`);
    }
  }

  console.log(`\nFinished at ${new Date().toISOString()}`);
}

run().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
