import "dotenv/config";
import { BedrockRuntimeClient, ConverseCommand, type ToolConfiguration } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ 
    region: "eu-west-3", 
});

const modelId = process.env.LLM_MODEL_ID || "eu.anthropic.claude-haiku-4-5-20251001-v1:0";

const toolConfig: ToolConfiguration = {
    tools: [
        {
            toolSpec: {
                name: "get_weather",
                description: "Get the current weather in a given location",
                inputSchema: {
                    json: {
                        type: "object",
                        properties: {
                            location: {
                                type: "string",
                                description: "The city and state, e.g. San Francisco, CA"
                            },
                            unit: {
                                type: "string",
                                enum: ["celsius", "fahrenheit"],
                                description: "The unit of temperature, either 'celsius' or 'fahrenheit'"
                            }
                        },
                        required: ["location"]
                    }
                }
            }
        }
    ]
};

async function run() {
    console.log("--- Tool Usage Test ---");
    
    let messages: any[] = [
        { 
            role: "user",
            content: [{ text: "What's the weather like in Paris?" }] 
        }
    ];

    try {
        console.log("Step 1: Sending prompt to model...");
        const response = await client.send(new ConverseCommand({ 
            modelId, 
            messages,
            toolConfig
        }));

        const outputMessage = response.output?.message;
        if (!outputMessage) {
            console.error("No output message received.");
            return;
        }

        messages.push(outputMessage);

        const toolUseBlocks = outputMessage.content?.filter(c => c.toolUse);
        
        if (toolUseBlocks && toolUseBlocks.length > 0) {
            console.log("Model requested tool use:", JSON.stringify(toolUseBlocks, null, 2));
            
            const toolResults = toolUseBlocks.map(block => {
                const toolUse = block.toolUse!;
                if (toolUse.name === "get_weather") {
                    const location = (toolUse.input as any).location;
                    console.log(`Executing client-side tool 'get_weather' for location: ${location}`);
                    
                    // Mock weather data
                    return {
                        toolResult: {
                            toolUseId: toolUse.toolUseId,
                            content: [{ text: `The weather in ${location} is 22°C and sunny.` }]
                        }
                    };
                }
                return null;
            }).filter(Boolean);

            if (toolResults.length > 0) {
                console.log("Step 2: Sending tool results back to model...");
                messages.push({
                    role: "user",
                    content: toolResults as any
                });

                const finalResponse = await client.send(new ConverseCommand({
                    modelId,
                    messages,
                    toolConfig
                }));

                const finalText = finalResponse.output?.message?.content?.[0]?.text;
                console.log("Final Response:", finalText);
            }
        } else {
            console.log("Model response:", outputMessage.content?.[0]?.text);
        }

    } catch (error: any) {
        console.error("--- Bedrock Error ---");
        console.error("Name:", error.name);
        console.error("Message:", error.message);
    }
}

run();
