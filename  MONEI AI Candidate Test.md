
# MONEI AI Candidate Test

This challenge is designed to assess your ability to build an AI-powered chatbot using TypeScript and Amazon Bedrock. You will create a conversational assistant that answers merchant questions about MONEI using our public documentation.

---

## Overview

Your task is to build an interactive CLI chatbot that helps merchants with MONEI integration questions. The chatbot should use an LLM (via Amazon Bedrock) and dynamically fetch relevant documentation pages to provide accurate, grounded answers.

---

## Business Requirements

1. **Interactive Chat:**
   - The chatbot runs as a local CLI application â€” a conversational loop where the user types questions and gets answers.
   - Responses must be accurate and grounded in MONEI documentation.
   - When the documentation doesn't cover a topic, the chatbot should clearly say it doesn't know rather than making things up.

2. **Documentation Retrieval:**
   - Use `https://docs.monei.com/llms.txt` as the entry point. This file contains summaries and links to detailed documentation pages.
   - The chatbot should follow these links to fetch the full content of relevant pages when it needs more detail to answer a question accurately.
   - The chatbot should be able to answer common merchant questions such as:
     - "How do I integrate Apple Pay?"
     - "What payment methods does MONEI support?"
     - "How do I verify webhook signatures?"

3. **Conversation Context:**
   - The chatbot should maintain conversation history within a session, so it can handle follow-up questions (e.g., "How do I set that up?" after asking about a payment method).

4. **Optional â€” Web Chat UI:**
   - If you are applying as a full-stack developer, you may also implement a simple web-based chat interface as an alternative to the CLI.
   - We recommend using [React](https://react.dev/) with [shadcn/ui](https://ui.shadcn.com/) and [Vercel AI SDK](https://ai-sdk.dev/) (`@ai-sdk/amazon-bedrock`) for streaming responses.
   - The UI should support markdown rendering in responses and show a loading state while the model is thinking.

---

## Technical Details

- **Language:** TypeScript (Node.js).

- **Amazon Bedrock:** Use the [Converse API](https://docs.aws.amazon.com/bedrock/latest/userguide/conversation-inference-call.html) for LLM inference. We recommend **Claude Sonnet** (`anthropic.claude-sonnet-4-6-20250514`), but any Bedrock model will work. You will need to [enable model access](https://docs.aws.amazon.com/bedrock/latest/userguide/model-access.html) in your AWS account before using it. For development and testing, you may want to use a cheaper model like **Claude Haiku** to keep costs low.

- **Tool Use:** The Converse API supports [tool use](https://docs.aws.amazon.com/bedrock/latest/userguide/tool-use.html), which allows the model to call functions you define. Use this to let the model fetch documentation pages on demand.

- **AWS Credentials:** You will need AWS credentials configured locally (via `~/.aws/credentials` or environment variables) with permissions to call Bedrock. No other AWS infrastructure is required â€” no Lambda, API Gateway, or deployment pipeline. Just a TypeScript project that runs with `npm start` or similar.

---

## Evaluation Criteria

We will evaluate your solution by chatting with the bot and checking:

- **Accuracy:** Does it give correct, detailed answers based on MONEI docs?
- **Retrieval quality:** Does it fetch the right documentation pages to answer each question?
- **Honesty:** Does it say "I don't know" when the docs don't cover a topic?
- **Conversation flow:** Can it handle follow-up questions naturally?
- **Code quality:** Is the code clean, well-structured, and easy to understand?

---

## Submission Instructions

- Please provide a link to a repository containing your solution, you can share private repository with `jimmyn`.
- Ensure the project is easy to set up and run.
- Document any assumptions or trade-offs made during development in the README.

Feel free to ask any questions if you need clarifications.

Good luck, and we look forward to reviewing your submission!

If you have any questions, you can ask Dmitriy ([dn@monei.com](mailto:dn@monei.com))