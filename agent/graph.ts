import { AIMessage, SystemMessage, type BaseMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { ChatGroq } from "@langchain/groq";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import { PROMPTS, PROMPT_VERSION, type PromptVersion } from "./support/prompt";
import { TOOLS } from "./support/tools";

const model = new ChatGroq({
  model: process.env["AGENT_MODEL"] ?? "openai/gpt-oss-120b",
  reasoningEffort: "low",
  temperature: 0,
}).bindTools(TOOLS);

// Streaming to useStream stores AI replies as v1 content blocks (reasoning + text),
// but Groq only accepts text in assistant content, so flatten them before sending.
// Checked by type, not class: streamed replies can be AIMessageChunks, and tool-calling turns
// must keep their tool_calls so the following tool results stay valid.
const toGroqMessages = (messages: BaseMessage[]) =>
  messages.map((message) =>
    message.getType() === "ai" && Array.isArray(message.content)
      ? new AIMessage({
          id: message.id,
          content: message.text,
          tool_calls: (message as AIMessage).tool_calls ?? [],
        })
      : message,
  );

// A run can pick the prompt version via config.configurable.prompt_version (used by the evals to
// compare versions); otherwise AGENT_PROMPT_VERSION / the latest version applies.
async function callModel(state: typeof MessagesAnnotation.State, config: RunnableConfig) {
  const requested = config.configurable?.["prompt_version"] as PromptVersion | undefined;
  const prompt = PROMPTS[requested && requested in PROMPTS ? requested : PROMPT_VERSION];
  const response = await model.invoke([
    new SystemMessage(prompt),
    ...toGroqMessages(state.messages),
  ]);
  return { messages: [response] };
}

// Customer-support agent: model <-> tools loop until the model answers without tool calls.
export const graph = new StateGraph(MessagesAnnotation)
  .addNode("model", callModel)
  .addNode("tools", new ToolNode(TOOLS))
  .addEdge(START, "model")
  .addConditionalEdges("model", toolsCondition, ["tools", END])
  .addEdge("tools", "model")
  .compile();
