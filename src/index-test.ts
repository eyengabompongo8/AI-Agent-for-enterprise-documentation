import { DocService } from "./doc-service.js";

/**
 * Simple test script for DocService to verify key-based navigation.
 */
async function runTest() {
  console.log("--- DocService Test ---");
  const service = new DocService();

  console.log("1. Initializing Documentation Service...");
  await service.initialize();

  
  console.log("\n2. Getting Clean Index...");
  const index = service.getCleanIndex();
  console.log("Index Sample (first 1000 chars):");
  console.log("-----------------------------------");
  console.log(index.substring(0, 1000) + "\n[...]");
  console.log("-----------------------------------");

  const keys = service.getAvailableKeys();
  console.log(`\nFound ${keys.length} document keys registered from index.`);

  console.log("\n--- Test Complete ---");
}

runTest().catch(console.error);
