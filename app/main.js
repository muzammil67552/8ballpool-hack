import OpenAI from "openai";
import fs from "fs/promises";

async function main() {
  const [, , flag, prompt] = process.argv;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }
  if (flag !== "-p" || !prompt) {
    throw new Error("error: -p flag is required");
  }

  const client = new OpenAI({
    apiKey: apiKey,
    baseURL: baseURL,
  });

  const messages = [
    {
      role: "system",
      content:
        "You have access to tools. Respond with only the final answer.",
    },
    { role: "user", content: prompt },
  ];

  const tools = [
    {
      type: "function",
      function: {
        name: "read",
        description: "Read a file from the filesystem",
        parameters: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path to the file",
            },
          },
          required: ["path"],
        },
      },
    },
  ];

  // 🔹 First request (LLM decides if tool is needed)
  let response = await client.chat.completions.create({
    model: "anthropic/claude-haiku-4.5",
    messages,
    tools,
    tool_choice: "auto",
  });

  if (!response.choices || response.choices.length === 0) {
    throw new Error("no choices in response");
  }

  let message = response.choices[0].message;

  // 🔹 If tool call happens → execute read tool
  if (message.tool_calls) {
    for (const call of message.tool_calls) {
      if (call.function.name === "read") {
        const args = JSON.parse(call.function.arguments);
        const fileContent = await fs.readFile(args.path, "utf-8");

        messages.push(message);
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: fileContent,
        });
      }
    }

    // 🔹 Second request with tool result
    response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages,
    });

    message = response.choices[0].message;
  }

  // ✅ Final output
  console.log(message.content.trim());
}

main();