"use client";

import type { FC, PropsWithChildren, ReactNode } from "react";
import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import {
  BookOpenIcon,
  CheckCircle2Icon,
  HeadsetIcon,
  LoaderIcon,
  PackageIcon,
  ShieldAlertIcon,
  XCircleIcon,
} from "lucide-react";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback.aui";
import type { ThreadGroupPart } from "@/components/assistant-ui/elements/thread.aui";
import { cn } from "@/lib/utils";

// Renders the support agent's tool calls (agent/support/tools.ts) as cards, so a viewer can see
// what the bot looked up and what the store system decided — the same data the DeepEval suite scores.

const TOOL_LABELS: Record<string, string> = {
  search_policy: "Searched store policy",
  lookup_order: "Looked up order",
  request_refund: "Refund request",
  cancel_order: "Cancel request",
  escalate_to_human: "Escalated to a specialist",
};

const parse = (result: unknown): Record<string, unknown> | string | undefined => {
  if (result === undefined || result === null) return undefined;
  const text = typeof result === "string" ? result : JSON.stringify(result);
  try {
    const value = JSON.parse(text);
    return typeof value === "object" && value !== null ? value : text;
  } catch {
    return text;
  }
};

const Card: FC<
  PropsWithChildren<{ icon: ReactNode; title: string; tone?: "ok" | "bad" | "info"; meta?: string }>
> = ({ icon, title, tone = "info", meta, children }) => (
  <div
    className={cn(
      "my-2 rounded-lg border px-3 py-2.5 text-sm",
      tone === "ok" && "border-emerald-500/40 bg-emerald-500/5",
      tone === "bad" && "border-red-500/40 bg-red-500/5",
      tone === "info" && "bg-muted/40",
    )}
  >
    <div className="flex items-center gap-2 font-medium">
      {icon}
      <span>{title}</span>
      {meta && <span className="text-muted-foreground ml-auto font-mono text-xs">{meta}</span>}
    </div>
    {children && <div className="text-muted-foreground mt-1.5 space-y-1">{children}</div>}
  </div>
);

const Row: FC<{ label: string; value: ReactNode }> = ({ label, value }) => (
  <div className="flex gap-2">
    <span className="w-28 shrink-0">{label}</span>
    <span className="text-foreground">{value}</span>
  </div>
);

const VerificationFailed: FC<{ text: string }> = ({ text }) => (
  <Card
    icon={<ShieldAlertIcon className="size-4 text-amber-600" />}
    title="Identity check failed"
    tone="bad"
  >
    {text.replace("VERIFICATION_FAILED: ", "")}
  </Card>
);

export const SupportToolCall: ToolCallMessagePartComponent = (props) => {
  const { toolName, args, result, status } = props;
  const label = TOOL_LABELS[toolName];
  if (!label) return <ToolFallback {...props} />;

  const orderId = (args as { order_id?: string }).order_id;
  if (status.type === "running" || result === undefined) {
    return (
      <Card
        icon={<LoaderIcon className="size-4 animate-spin" />}
        title={`${label}…`}
        meta={orderId}
      >
        {toolName === "search_policy" && `“${(args as { query?: string }).query ?? ""}”`}
      </Card>
    );
  }

  const data = parse(result);
  if (typeof data === "string" && data.startsWith("VERIFICATION_FAILED"))
    return <VerificationFailed text={data} />;

  if (toolName === "search_policy") {
    const sections = typeof data === "string" ? [...data.matchAll(/^\[([\w-]+)\] (.+)$/gm)] : [];
    return (
      <Card
        icon={<BookOpenIcon className="size-4" />}
        title={label}
        meta={`“${(args as { query?: string }).query ?? ""}”`}
      >
        {sections.length ? (
          <div className="flex flex-wrap gap-1.5">
            {sections.map((m) => (
              <span
                key={m[1]}
                className="bg-background rounded border px-1.5 py-0.5 text-xs"
                title={m[1]}
              >
                {m[2]}
              </span>
            ))}
          </div>
        ) : (
          "No matching policy section."
        )}
      </Card>
    );
  }

  if (typeof data !== "object" || !data) return <ToolFallback {...props} />;

  if (toolName === "lookup_order") {
    const items = (data["items"] as { name: string; price: number }[]) ?? [];
    return (
      <Card icon={<PackageIcon className="size-4" />} title={label} meta={String(data["id"])}>
        <Row label="Status" value={String(data["status"])} />
        <Row label="Items" value={items.map((i) => `${i.name} ($${i.price})`).join(", ")} />
        <Row label="Delivered" value={String(data["deliveredOn"] ?? "not yet")} />
        <Row label="Shipping" value={String(data["shipping"])} />
      </Card>
    );
  }

  if (toolName === "request_refund") {
    const approved = data["decision"] === "APPROVED";
    return (
      <Card
        icon={
          approved ? (
            <CheckCircle2Icon className="size-4 text-emerald-600" />
          ) : (
            <XCircleIcon className="size-4 text-red-600" />
          )
        }
        title={approved ? `Refund approved: $${data["amount"]}` : "Refund denied"}
        tone={approved ? "ok" : "bad"}
        meta={String(data["orderId"])}
      >
        {approved ? (
          <>
            <div>{String(data["breakdown"])}</div>
            <Row label="Refund to" value={String(data["refundTo"])} />
          </>
        ) : (
          String(data["reason"])
        )}
      </Card>
    );
  }

  if (toolName === "cancel_order") {
    const ok = data["cancelled"] === true;
    return (
      <Card
        icon={
          ok ? (
            <CheckCircle2Icon className="size-4 text-emerald-600" />
          ) : (
            <XCircleIcon className="size-4 text-red-600" />
          )
        }
        title={ok ? `Order cancelled, $${data["refundAmount"]} refunded` : "Cannot cancel"}
        tone={ok ? "ok" : "bad"}
        meta={String(data["orderId"])}
      >
        {!ok && String(data["reason"])}
      </Card>
    );
  }

  return (
    <Card icon={<HeadsetIcon className="size-4" />} title={label} meta={String(data["ticketId"])}>
      Reply within {String(data["replyWithin"])}
    </Card>
  );
};

// Show tool cards inline instead of collapsing them into a "used N tools" group.
export const SupportToolGroup: FC<PropsWithChildren<{ group: ThreadGroupPart }>> = ({
  children,
}) => <div className="flex flex-col">{children}</div>;
