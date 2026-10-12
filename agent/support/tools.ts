import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ORDERS, POLICIES, TODAY, type Order } from "./data";

const DAY_MS = 24 * 60 * 60 * 1000;

const daysSince = (date: string) => Math.floor((Date.parse(TODAY) - Date.parse(date)) / DAY_MS);

const round2 = (n: number) => Math.round(n * 100) / 100;

const STOPWORDS = new Set(
  "a an and are as at be can do for from how i if in is it my of on or the to what when with you your".split(
    " ",
  ),
);

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9$% ]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, ""));

// Keyword-overlap retrieval over the policy sections. Small on purpose: retrieval quality is
// one of the things the DeepEval suite measures (contextual relevancy / faithfulness).
export function searchPolicies(query: string, k = 3) {
  const q = new Set(tokenize(query));
  return POLICIES.map((p) => {
    const words = tokenize(`${p.title} ${p.title} ${p.text}`);
    const score = words.filter((w) => q.has(w)).length / Math.sqrt(words.length);
    return { p, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((r) => r.p);
}

function findOrder(orderId: string, email: string): Order | string {
  const order = ORDERS.find((o) => o.id.toLowerCase() === orderId.trim().toLowerCase());
  if (!order || order.email.toLowerCase() !== email.trim().toLowerCase()) {
    return "VERIFICATION_FAILED: no order matches this order ID and email. Ask the customer to double-check both.";
  }
  return order;
}

const describeOrder = (o: Order) =>
  JSON.stringify({
    id: o.id,
    customerName: o.customerName,
    status: o.status,
    orderedOn: o.orderedOn,
    deliveredOn: o.deliveredOn ?? null,
    daysSinceDelivery: o.deliveredOn ? daysSince(o.deliveredOn) : null,
    shipping: o.shipping,
    shippingCost: o.shippingCost,
    payment: o.payment,
    damageReportedOn: o.damageReportedOn ?? null,
    items: o.items,
  });

export const searchPolicy = tool(
  async ({ query }) => {
    const hits = searchPolicies(query);
    if (!hits.length) return "NO_MATCH: no policy section matches this query.";
    return hits.map((p) => `[${p.id}] ${p.title}\n${p.text}`).join("\n\n");
  },
  {
    name: "search_policy",
    description:
      "Search ShopNova's store policies (returns, refunds, shipping, cancellation, warranty, privacy). Use it before answering any policy question.",
    schema: z.object({
      query: z.string().describe("Short search query, e.g. 'return window opened electronics'"),
    }),
  },
);

export const lookupOrder = tool(
  async ({ order_id, email }) => {
    const order = findOrder(order_id, email);
    return typeof order === "string" ? order : describeOrder(order);
  },
  {
    name: "lookup_order",
    description:
      "Look up an order. Requires the order ID and the email address on the order (identity verification).",
    schema: z.object({
      order_id: z.string().describe("Order ID, e.g. SN-1001"),
      email: z.string().describe("Email address the customer used for the order"),
    }),
  },
);

export const requestRefund = tool(
  async ({ order_id, email, reason }) => {
    const order = findOrder(order_id, email);
    if (typeof order === "string") return order;
    const deny = (why: string) =>
      JSON.stringify({ decision: "DENIED", orderId: order.id, reason: why });

    if (order.status === "Refunded") return deny("This order has already been refunded.");
    if (order.status === "Processing")
      return deny("Order has not shipped yet; cancel it with cancel_order instead of refunding.");
    if (order.status === "Shipped")
      return deny("Order is in transit; a return can start after delivery.");

    const days = daysSince(order.deliveredOn!);
    const itemTotal = order.items.reduce((s, i) => s + i.price, 0);
    const method =
      order.payment === "card" ? "card (5-7 business days)" : "PayPal (3-5 business days)";

    const damaged =
      order.damageReportedOn &&
      daysSince(order.deliveredOn!) - daysSince(order.damageReportedOn) <= 2;
    if (damaged) {
      return JSON.stringify({
        decision: "APPROVED",
        orderId: order.id,
        amount: round2(itemTotal + order.shippingCost),
        breakdown: "Full refund of items and original shipping (damage reported within 48 hours).",
        refundTo: method,
      });
    }
    if (order.items.some((i) => i.finalSale))
      return deny("Final Sale items cannot be returned or refunded.");

    const openedElectronics = order.items.some((i) => i.category === "electronics" && i.opened);
    if (openedElectronics) {
      if (days > 15)
        return deny(
          `Opened electronics must be returned within 15 days of delivery; it has been ${days} days.`,
        );
      return JSON.stringify({
        decision: "APPROVED",
        orderId: order.id,
        amount: round2(itemTotal * 0.85),
        breakdown: `Item price $${itemTotal} minus 15% restocking fee for opened electronics; shipping not refunded.`,
        refundTo: method,
      });
    }
    if (days > 30)
      return deny(`The 30-day return window has passed; it has been ${days} days since delivery.`);
    return JSON.stringify({
      decision: "APPROVED",
      orderId: order.id,
      amount: round2(itemTotal),
      breakdown: `Full item price; original shipping not refunded. Reason given: ${reason}`,
      refundTo: method,
    });
  },
  {
    name: "request_refund",
    description:
      "Submit a refund/return request for a delivered order. The system applies store policy and returns APPROVED (with amount) or DENIED (with reason).",
    schema: z.object({
      order_id: z.string(),
      email: z.string(),
      reason: z.string().describe("Customer's reason for the return"),
    }),
  },
);

export const cancelOrder = tool(
  async ({ order_id, email }) => {
    const order = findOrder(order_id, email);
    if (typeof order === "string") return order;
    if (order.status !== "Processing")
      return JSON.stringify({
        cancelled: false,
        orderId: order.id,
        reason: `Order status is ${order.status}; only Processing orders can be cancelled.`,
      });
    const total = round2(order.items.reduce((s, i) => s + i.price, 0) + order.shippingCost);
    return JSON.stringify({
      cancelled: true,
      orderId: order.id,
      refundAmount: total,
      refundTo: order.payment,
    });
  },
  {
    name: "cancel_order",
    description: "Cancel an order that has not shipped yet (status Processing).",
    schema: z.object({ order_id: z.string(), email: z.string() }),
  },
);

export const escalateToHuman = tool(
  async ({ summary }) =>
    JSON.stringify({
      ticketId: `ESC-${Math.abs(hash(summary)) % 100000}`,
      replyWithin: "1 business day",
    }),
  {
    name: "escalate_to_human",
    description:
      "Hand the case to a human specialist. Use for warranty claims, angry customers asking for a human, or anything the policies do not cover.",
    schema: z.object({ summary: z.string().describe("One-paragraph summary of the case") }),
  },
);

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

export const TOOLS = [searchPolicy, lookupOrder, requestRefund, cancelOrder, escalateToHuman];
