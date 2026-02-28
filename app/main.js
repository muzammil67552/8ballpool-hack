import OpenAI from "openai";

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

  // ✅ UPDATED BLOCK — tools added
 const response = await client.chat.completions.create({
  model: "anthropic/claude-haiku-4.5",
  messages: [
    {
      role: "system",
      content:
        "You have access to tools. Answer with only the final number. No explanation.",
    },
    { role: "user", content: prompt },
  ],
  tools: [
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
  ],
  tool_choice: "auto", // ⭐ IMPORTANT
});

  if (!response.choices || response.choices.length === 0) {
    throw new Error("no choices in response");
  }

  // ✅ Print ONLY the answer
  console.log(response.choices[0].message.content.trim());
}

main();