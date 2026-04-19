import "dotenv/config";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

// Initialize client using the Bearer Token authentication
const client = new BedrockRuntimeClient({ 
    region: "eu-west-3", 
});

async function run() {
    try {
        const response = await client.send(new ConverseCommand({ 
            modelId: process.env.LLM_MODEL_ID || "eu.anthropic.claude-haiku-4-5-20251001-v1:0", 
            messages: [
                { 
                    role: "user",
                    content: [{ text: "Write a one-sentence bedtime story about a unicorn." }] 
                } 
            ] 
        }));

        const text = response.output?.message?.content?.[0]?.text;
        console.log("Response:", text);
    } catch (error: any) {
        console.error("--- Bedrock Error ---");
        console.error("Name:", error.name);
        console.error("Message:", error.message);
    }
}

run();