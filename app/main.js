import OpenAI from "openai";
import fs from "fs/promises";

async function main() {
  const [, , flag, prompt] = process.argv;
  const apiKey = process.env.OPENROUTER_API_KEY;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
  if (flag !== "-p" || !prompt) throw new Error("error: -p flag is required");

  const client = new OpenAI({ apiKey, baseURL });

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
            path: { type: "string" },
          },
          required: ["path"],
        },
      },
    },
    {
      type: "function",
      function: {
        name: "write",
        description: "Write content to a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" },
          },
          required: ["path", "content"],
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

    if (!response.choices || response.choices.length === 0)
      throw new Error("no choices in response");

    const message = response.choices[0].message;

    // ✅ Final answer if no tool calls
    if (!message.tool_calls) {
      console.log(message.content.trim());
      return;
    }

    messages.push(message);

    // Execute tool calls
    for (const call of message.tool_calls) {
      const args = JSON.parse(call.function.arguments);

      if (call.function.name === "read") {
        const fileContent = await fs.readFile(args.path, "utf-8");
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: fileContent,
        });
      } else if (call.function.name === "write") {
        // Ensure directory exists
        await fs.mkdir(args.path.split("/").slice(0, -1).join("/"), {
          recursive: true,
        });
        await fs.writeFile(args.path, args.content, "utf-8");
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: `File written: ${args.path}`,
        });
      }
    }
  }
}

main();