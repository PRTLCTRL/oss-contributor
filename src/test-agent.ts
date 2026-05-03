import { Agent } from "@cursor/sdk";
import "dotenv/config";

async function testSingleAgent() {
  console.log("Testing single agent against PRTLCTRL/typescript-sdk...");
  try {
    const result = await Agent.prompt(
      "List the files in the root of the repository. Just list them and stop.",
      {
        apiKey: process.env.CURSOR_API_KEY!,
        cloud: {
          repos: [{ url: "https://github.com/PRTLCTRL/typescript-sdk" }],
          autoCreatePR: false,
          skipReviewerRequest: true,
        },
      }
    );
    console.log("Status:", result.status);
    console.log("Agent ID:", result.id);
  } catch (err: any) {
    console.error("Error:", err?.message || err);
  }
}

testSingleAgent();
