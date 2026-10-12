import { ChatOpenAI } from "@langchain/openai";
import { END, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";

const model = new ChatOpenAI({
  model: "gpt-6-luna",
  useResponsesApi: true,
  reasoning: { effort: "low", summary: "auto" },
});

async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

export const graph = new StateGraph(MessagesAnnotation)
  .addNode("model", callModel)
  .addEdge(START, "model")
  .addEdge("model", END)
  .compile();
