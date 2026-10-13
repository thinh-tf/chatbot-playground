"use client";

import type { FC } from "react";

// Demo orders from agent/support/data.ts, so testers know which scenario each order exercises.
const DEMO_ORDERS = [
  { id: "SN-1001", email: "alice@example.com", scenario: "Within 30-day window" },
  { id: "SN-1002", email: "bao@example.com", scenario: "Window expired" },
  { id: "SN-1003", email: "chloe@example.com", scenario: "Opened electronics, 15% fee" },
  { id: "SN-1004", email: "dan@example.com", scenario: "Final sale" },
  { id: "SN-1005", email: "emma@example.com", scenario: "Shipped, in transit" },
  { id: "SN-1006", email: "felix@example.com", scenario: "Processing, cancellable" },
  { id: "SN-1007", email: "gia@example.com", scenario: "Damaged, reported" },
  { id: "SN-1009", email: "ivy@example.com", scenario: "Phone defect, warranty" },
];

export const SupportWelcome: FC = () => (
  <div className="mb-6 flex flex-col gap-4 px-2">
    <div className="fade-in slide-in-from-bottom-1 animate-in fill-mode-both duration-200">
      <p className="text-2xl font-medium tracking-tight">
        Hi, I&apos;m Nova from ShopNova support.
      </p>
      <p className="text-muted-foreground mt-1 text-sm">
        I can check orders, process returns and refunds, cancel orders and answer shipping or
        warranty questions. Share your order ID and email to get started.
      </p>
      <p className="text-muted-foreground mt-2 text-xs">
        Tool-calling agent (LangGraph ReAct loop + agentic RAG over store policies), running on
        Groq gpt-oss-120b.
      </p>
    </div>
    <details className="text-sm">
      <summary className="text-muted-foreground cursor-pointer select-none">
        Demo orders (test data)
      </summary>
      <div className="mt-2 overflow-x-auto rounded-md border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">Order</th>
              <th className="px-2 py-1.5 font-medium">Email</th>
              <th className="px-2 py-1.5 font-medium">Scenario</th>
            </tr>
          </thead>
          <tbody>
            {DEMO_ORDERS.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-2 py-1.5 font-mono">{o.id}</td>
                <td className="px-2 py-1.5 font-mono">{o.email}</td>
                <td className="px-2 py-1.5">{o.scenario}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  </div>
);
