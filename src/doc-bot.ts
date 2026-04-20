import "dotenv/config";
import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ToolConfiguration,
  type Message,
  type ContentBlock
} from "@aws-sdk/client-bedrock-runtime";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as fs from "node:fs/promises";
import { DocService } from "./doc-service.js";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "eu-west-3",
});

const modelId = process.env.LLM_MODEL_ID || "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

const docService = new DocService();

// Simple Observability Flag
const isObservabilityEnabled = process.argv.includes("--observe") || process.argv.includes("-o");

const toolConfig: ToolConfiguration = {
  tools: [
    {
      toolSpec: {
        name: "list_available_docs",
        description: "Returns a summarized list of all available documentation pages at MONEI. Use this to identify which page to fetch for more details.",
        inputSchema: {
          json: {
            type: "object",
            properties: {},
            required: []
          }
        }
      }
    },
    {
      toolSpec: {
        name: "get_doc_content",
        description: "Fetches the full content of a specific documentation page by its key (e.g. '#ref123'). The content is preprocessed and may contain further keys for navigation.",
        inputSchema: {
          json: {
            type: "object",
            properties: {
              pageKey: {
                type: "string",
                description: "The unique key of the document to fetch (e.g., '#ref5')"
              }
            },
            required: ["pageKey"]
          }
        }
      }
    }
  ]
};

const getSystemPrompt = (index: string) => `You are the MONEI AI Doc-Bot, a helpful assistant that answers merchant questions using MONEI's public documentation.

Guidelines:
1. ALWAYS use the provided tools to find accurate information. 
2. Use the provided 'Documentation Index' to identify which page contains the answer.
3. Call 'get_doc_content' with the relevant page key (e.g., '#ref123') to read the details.
4. Your responses must be grounded ONLY in the provided documentation.
5. If the documentation does not contain the answer, clearly state: "I don't know the answer to that based on the available documentation." Do NOT hallucinate.
6. Documentation content may contain links formatted as 'Title [Key]'. You can use these keys to navigate to related documentation.
7. Maintain a professional and helpful tone.

Documentation Index:
${index}
`;

async function main() {
  console.log("--- MONEI AI Doc-Bot ---");
  console.log("Initializing documentation service...");

  try {
    await docService.initialize();
    console.log("Documentation index loaded.");
  } catch (error) {
    console.error("Failed to initialize DocService:", error);
    process.exit(1);
  }

  const rl = readline.createInterface({ input, output });
  const messages: Message[] = [];
  const systemPrompt = getSystemPrompt(docService.getCleanIndex());

  console.log("\nBot: Hello! I'm here to help you with MONEI integration. What can I do for you today?");

  while (true) {
    const userInput = await rl.question("\nYou: ");
    if (userInput === "exit") {
      console.log("Bot: Goodbye!");
      break;
    }

    messages.push({
      role: "user",
      content: [{ text: userInput }]
    });

    await processBedrockInteraction(messages, systemPrompt);
  }

  if (isObservabilityEnabled) {
    await saveObservationLog(messages);
  }

  rl.close();
}

async function processBedrockInteraction(
  messages: Message[], 
  systemPrompt: string
) {
  try {
    process.stdout.write("Bot is thinking...");

    let response = await client.send(new ConverseCommand({
      modelId,
      messages,
      system: [{ text: systemPrompt }],
      toolConfig
    }));

    // Clear thinking indicator
    process.stdout.write("\r\x1b[K");

    while (response.output?.message?.content?.some(c => c.toolUse)) {
      const outputMessage = response.output.message!;
      messages.push(outputMessage);

      // Print any text content the bot might have included with the tool call
      outputMessage.content?.forEach(block => {
        if (block.text) {
          console.log(`Bot: ${block.text}\n[...]`);
        }
      });

      const toolResults: any[] = [];
      const toolUses = outputMessage.content?.filter(c => c.toolUse) || [];

      for (const block of toolUses) {
        const toolUse = block.toolUse!;
        console.log(`[Tool] Calling ${toolUse.name}(${JSON.stringify(toolUse.input)})...`);

        let resultText = "";
        if (toolUse.name === "list_available_docs") {
          resultText = docService.getCleanIndex();
        } else if (toolUse.name === "get_doc_content") {
          const pageKey = (toolUse.input as any).pageKey;
          resultText = await docService.getCleanPage(pageKey);
        }

        toolResults.push({
          toolResult: {
            toolUseId: toolUse.toolUseId,
            content: [{ text: resultText }]
          }
        });
      }

      messages.push({
        role: "user",
        content: toolResults
      });

      process.stdout.write("Bot is processing documentation...");
      response = await client.send(new ConverseCommand({
        modelId,
        messages,
        system: [{ text: systemPrompt }],
        toolConfig
      }));
      process.stdout.write("\r\x1b[K");
    }

    const finalMessage = response.output?.message;
    if (finalMessage) {
      messages.push(finalMessage);
      finalMessage.content?.forEach(block => {
        if (block.text) {
          console.log(`Bot: ${block.text}`);
        }
      });
    }

  } catch (error: any) {
    console.error("\n--- Bedrock Error ---");
    console.error(error.message);
  }
}

/**
 * Saves the conversation history and tool usage to a JSON file.
 * Enriches the log with resolved URLs for tool executions.
 */
async function saveObservationLog(messages: Message[]) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `traces/obs-log-${timestamp}.json`;
  
  try {
    // Enrich messages with URLs for documentation lookups
    const enrichedMessages = messages.map(msg => {
      const enrichedContent = msg.content?.map(block => {
        if (block.toolUse && block.toolUse.name === "get_doc_content") {
          const pageKey = (block.toolUse.input as any).pageKey;
          const url = docService.getUrlByKey(pageKey);
          if (url) {
            return {
              ...block,
              toolUse: {
                ...block.toolUse,
                "url": url
              }
            };
          }
        }
        return block;
      });
      return { ...msg, content: enrichedContent };
    });

    const logData = {
      timestamp: new Date().toISOString(),
      modelId,
      messages: enrichedMessages
    };
    await fs.writeFile(fileName, JSON.stringify(logData, null, 2));
    console.log(`\n[Observability] Session log saved to: ${fileName}`);
  } catch (error) {
    console.error("\n[Observability] Failed to save session log:", error);
  }
}

main();
