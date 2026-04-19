import "dotenv/config";
import { BedrockClient, ListFoundationModelsCommand, ListInferenceProfilesCommand } from "@aws-sdk/client-bedrock";

const client = new BedrockClient({ 
    region: "eu-west-3",
});

async function listAll() {
    console.log("--- Foundation Models ---");
    try {
        const models = await client.send(new ListFoundationModelsCommand({ byProvider: "Anthropic" }));
        models.modelSummaries?.forEach(m => {
            console.log(`ID: ${m.modelId} | Name: ${m.modelName}`);
        });
    } catch (e: any) {
        console.error("Error listing Foundation Models:", e.name, e.message);
    }

    console.log("\n--- Inference Profiles ---");
    try {
        const iProfiles = await client.send(new ListInferenceProfilesCommand({}));
        iProfiles.inferenceProfileSummaries?.forEach(p => {
            console.log(`ID: ${p.inferenceProfileId} | Name: ${p.inferenceProfileName}`);
        });
    } catch (e: any) {
        console.error("Error listing Inference Profiles:", e.name, e.message);
    }
}

listAll();
