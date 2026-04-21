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
import * as path from "node:path";
import { DocService } from "./doc-service.js";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "eu-west-3",
});

const modelId = process.env.LLM_MODEL_ID || "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

const docService = new DocService();

const MAX_AGENT_CALLS = parseInt(process.env.MAX_AGENT_CALLS || "5", 10);
const MAX_HISTORY_MESSAGES = parseInt(process.env.MAX_HISTORY_MESSAGES || "10", 10);

// Simple Observability Flag
const isObservabilityEnabled = process.argv.includes("--observe") || process.argv.includes("-o");

const toolConfig: ToolConfiguration = {
  tools: [
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

const getSystemPrompt = (index: string) => `You are the MONEI AI Documentation Agent, a helpful assistant that answers merchant questions using MONEI's public documentation.

Guidelines:
1. ALWAYS use the provided tools to find accurate information. 
2. Use the provided 'Documentation Index' to identify which page contains the answer.
3. Documentation content may contain links formatted as 'Title [Key]'. You can use these keys to navigate to related documentation.
4. Call 'get_doc_content' with the relevant page key (e.g., '#ref123') to read the content of the linked document.
5. Your responses must be grounded ONLY in the provided documentation.
6. If the documentation does not contain the answer, clearly tell the user that you don't know the answer based on the available documentation. Do NOT hallucinate.
7. Maintain a professional and helpful tone.
8. Restrict the conversation to MONEI documentation. If the user drifts off-topic, politely redirect them back to MONEI-related queries.

Documentation Index:
${index}
`;

async function main() {
  console.log("--- MONEI AI Doc-Agent ---");
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

  console.log("\nAgent: Hello! I'm here to help you with MONEI integration. What can I do for you today?");

  while (true) {
    const userInput = await rl.question("\nYou: ");
    if (userInput === "exit") {
      console.log("Agent: Goodbye!");
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
    process.stdout.write("Agent is thinking...");

    const getRequestMessages = () => {
      if (messages.length <= MAX_HISTORY_MESSAGES) return messages;
      let startIndex = messages.length - MAX_HISTORY_MESSAGES;

      // Step back to ensure the convo start at a 'user' message that is a text prompt, 
      // not a tool result. Otherwise the Converse API might throw errors 
      while (startIndex > 0) {
        const msg = messages[startIndex];
        const isUserTextOnly = msg?.role === "user" && !msg?.content?.some(c => c.toolResult);
        if (isUserTextOnly) break;
        startIndex--;
      }
      return messages.slice(startIndex);
    };

    let currentToolConfig: ToolConfiguration | undefined = toolConfig;
    let callCount = 1;

    let response = await client.send(new ConverseCommand({
      modelId,
      messages: getRequestMessages(),
      system: [{ text: systemPrompt }],
      toolConfig: currentToolConfig
    }));

    // Clear thinking indicator
    process.stdout.write("\r\x1b[K");

    while (response.output?.message?.content?.some(c => c.toolUse)) {
      callCount++;
      const outputMessage = response.output.message!;
      messages.push(outputMessage);

      // Print any intermediate response that the agent might have included with a tool call
      outputMessage.content?.forEach(block => {
        if (block.text) {
          const resolvedText = docService.resolveReferences(block.text);
          console.log(`Agent: ${resolvedText}\n[...]`);
        }
      });

      const toolResults: any[] = [];
      const toolUses = outputMessage.content?.filter(c => c.toolUse) || [];

      for (const block of toolUses) {
        const toolUse = block.toolUse!;

        let resultText = "";

        if (toolUse.name === "get_doc_content") {
          const pageKey = (toolUse.input as any).pageKey;
          const url = docService.getUrlByKey(pageKey);
          console.log(`\n📄 Agent is reading documentation page: ${url}...`);

          resultText = await docService.getCleanPage(pageKey);
        } else {
          // Generic tool call handler
          // get_doc_content is the only tool so this case should never happen
          console.log(`\n🔧 Calling ${toolUse.name}(${JSON.stringify(toolUse.input)})...`);
        }

        toolResults.push({
          toolResult: {
            toolUseId: toolUse.toolUseId,
            content: [{ text: resultText }]
          }
        });
      }

      if (callCount > MAX_AGENT_CALLS) {
        toolResults.push({
          text: "SYSTEM: You have reached the maximum number of tool calls permitted for this turn. You MUST now provide a conversational response to the user. If you need more information, explicitly tell the user you need more time and ask if they would like you to keep searching."
        });
        // Hide tools to ensure the agent sends a conversational response
        currentToolConfig = undefined;
      }

      messages.push({
        role: "user",
        content: toolResults
      });

      process.stdout.write("Agent is processing documentation...");
      response = await client.send(new ConverseCommand({
        modelId,
        messages: getRequestMessages(),
        system: [{ text: systemPrompt }],
        toolConfig: currentToolConfig
      }));
      process.stdout.write("\r\x1b[K");
    }

    const finalMessage = response.output?.message;
    if (finalMessage) {
      messages.push(finalMessage);
      finalMessage.content?.forEach(block => {
        if (block.text) {
          const resolvedText = docService.resolveReferences(block.text);
          console.log(`Agent: ${resolvedText}`);
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
**/
async function saveObservationLog(messages: Message[]) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const logDir = path.join(process.cwd(), "traces");
  const fileName = path.join(logDir, `obs-log-${timestamp}.json`);

  try {
    // Ensure the directory exists
    await fs.mkdir(logDir, { recursive: true });

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
