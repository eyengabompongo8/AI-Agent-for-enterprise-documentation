import { DocService } from "./doc-service.js";

/**
 * This script tests the tool execution logic specifically for 'get_doc_content'.
 * It simulates how the bot handles a toolUse request from Bedrock.
 */
async function testTool() {
  console.log("--- Doc Tool Execution Test ---");
  const service = new DocService();

  console.log("1. Initializing Service...");
  await service.initialize();

  const url = "https://docs.monei.com/channel-tokenization.md";

  // This mimics the logic in doc-agent.ts
  try {
    console.log(`[Tool] Calling get_doc_content({"url": "${url}"})...`);
    const resultText = await service._getCleanPage(url);

    console.log("\n3. Tool Result Preview:");
    console.log("-----------------------------------");
    // Show a bit of the result
    // console.log(resultText.substring(0, 800) + "...");
    console.log(resultText);
    console.log("-----------------------------------");

    if (resultText.includes("Error:")) {
      console.log("\nRESULT: FAILED - Tool returned an error message.");
    } else {
      console.log("\nRESULT: SUCCESS - Tool successfully retrieved and processed the page.");
    }

  } catch (error) {
    console.error("\nRESULT: FAILED - Tool execution threw an error:", error);
  }
}

testTool().catch(console.error);
