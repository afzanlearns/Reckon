// THIS IS THE ONLY FILE ALLOWED TO CALL AN LLM API.
// PRE-EVENT: direct Anthropic API. ON-SITE: swap the inside of this function for OpenSwarm.
// The function signature must never change.

export async function callAgent(systemPrompt: string, userMessage: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });
  const data = await response.json();
  const textBlock = data.content.find((block: { type: string; text: string }) => block.type === "text");
  return textBlock ? textBlock.text : "";
}