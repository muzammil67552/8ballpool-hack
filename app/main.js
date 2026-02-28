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
    apiKey,
    baseURL,
  });

  const messages = [
    {
      role: "system",
      content:
        "You are an agent with tools. Use tools if needed and respond with only the final answer.",
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

  while (true) {
    const response = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages,
      tools,
      tool_choice: "auto",
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error("no choices in response");
    }

    const message = response.choices[0].message;

    // ✅ If no tool call → final answer
    if (!message.tool_calls) {
      console.log(message.content.trim());
      return;
    }

    // Add assistant message with tool call
    messages.push(message);

    // Execute each tool call
    for (const call of message.tool_calls) {
      if (call.function.name === "read") {
        const args = JSON.parse(call.function.arguments);
        const fileContent = await fs.readFile(args.path, "utf-8");

        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: fileContent,
        });
      }
    }
  }
}

main();