"use client";

import { AssistantRuntimeProvider, AuiConfig, Suggestions } from "@assistant-ui/react";
import { useStreamRuntime } from "@assistant-ui/react-langchain";
import { Thread, type ThreadComponents } from "@/components/assistant-ui/elements/thread.aui";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/elements/threadlist-sidebar.aui";
import { Separator } from "@/components/ui/separator";
import { SupportToolCall, SupportToolGroup } from "@/components/support/tool-cards";
import { SupportWelcome } from "@/components/support/welcome";

const THREAD_COMPONENTS: ThreadComponents = {
  Welcome: SupportWelcome,
  ToolFallback: SupportToolCall,
  ToolGroup: SupportToolGroup,
};

// One suggestion per behaviour the DeepEval suite checks (tests/evals/.dataset.json).
const config = AuiConfig({
  suggestions: Suggestions([
    {
      title: "Return opened headphones",
      label: "order SN-1003, chloe@example.com",
      prompt:
        "Order SN-1003, chloe@example.com. I opened the headphones but they hurt my ears, can I send them back?",
    },
    {
      title: "Damaged item",
      label: "lamp arrived broken, SN-1007",
      prompt:
        "My glass lamp from order SN-1007 arrived shattered, I already sent the photo yesterday. Email gia@example.com. What now?",
    },
    {
      title: "Cancel an order",
      label: "SN-1006, felix@example.com",
      prompt: "Please cancel order SN-1006, my email is felix@example.com.",
    },
    {
      title: "Shipping policy",
      label: "how long, is it free?",
      prompt: "How long does standard shipping take and is it free?",
    },
  ]),
});

export const Assistant = () => {
  const runtime = useStreamRuntime({
    assistantId: process.env["NEXT_PUBLIC_LANGGRAPH_ASSISTANT_ID"]!,
    apiUrl: process.env["NEXT_PUBLIC_LANGGRAPH_API_URL"],
  });

  return (
    <AssistantRuntimeProvider runtime={runtime} config={config}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-semibold">ShopNova Support</span>
                <span className="text-muted-foreground text-xs">
                  Nova · orders, returns, refunds, shipping
                </span>
              </div>
              <span
                className="text-muted-foreground ml-auto rounded-full border px-2.5 py-0.5 text-xs"
                title="LangGraph ReAct loop: the LLM picks a tool, reads its result, then calls another tool or replies. search_policy retrieves policy sections (agentic RAG)."
              >
                Tool-calling agent · LangGraph + RAG
              </span>
            </header>
            <div className="flex-1 overflow-hidden">
              <Thread components={THREAD_COMPONENTS} />
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};
