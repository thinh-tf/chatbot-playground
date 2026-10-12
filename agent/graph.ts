import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import { ChatGroq } from "@langchain/groq";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";

const model = new ChatGroq({
  model: "openai/gpt-oss-120b",
  reasoningEffort: "low",
});

// Streaming to useStream stores AI replies as v1 content blocks (reasoning + text),
// but Groq only accepts text in assistant content, so flatten them before sending.
const toGroqMessages = (messages: BaseMessage[]) =>
  messages.map((message) =>
    AIMessage.isInstance(message) && Array.isArray(message.content)
      ? new AIMessage({ ...message, content: message.text })
      : message,
  );

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(toGroqMessages(state.messages));
  return { messages: [response] };
}

export const graph = new StateGraph(MessagesAnnotation)
  .addNode("model", callModel)
  .addEdge(START, "model")
  .addEdge("model", END)
  .compile();
