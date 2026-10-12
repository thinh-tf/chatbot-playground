// Fictional store data for the ShopNova customer-support agent.
// Everything is deterministic (fixed "today") so evals give stable results.

export const STORE_NAME = "ShopNova";
export const TODAY = "2026-10-12";

export type PolicySection = { id: string; title: string; text: string };

export const POLICIES: PolicySection[] = [
  {
    id: "returns-window",
    title: "Return window",
    text: "Most items can be returned within 30 days of the delivery date for a full refund of the item price. Items must be unused and in original packaging. Opened electronics (laptops, phones, tablets, headphones, cameras) can be returned within 15 days of delivery and are subject to a 15% restocking fee. Returns are not possible for orders that have not been delivered yet; cancel the order instead.",
  },
  {
    id: "final-sale",
    title: "Final sale and non-returnable items",
    text: "Items marked Final Sale, gift cards, downloadable software and opened personal-care products (earbuds tips, razors) cannot be returned or refunded, except when they arrive damaged or defective.",
  },
  {
    id: "damaged-items",
    title: "Damaged, defective or wrong items",
    text: "If an item arrives damaged, defective or is not the item ordered, the customer must report it within 48 hours of delivery with a photo. ShopNova then issues a full refund including original shipping cost, or a free replacement, and no restocking fee applies. Reports after 48 hours are handled under the manufacturer warranty.",
  },
  {
    id: "refund-processing",
    title: "Refund processing time",
    text: "Approved refunds go back to the original payment method. Card refunds take 5-7 business days after approval; PayPal refunds take 3-5 business days; store credit is issued instantly. Original shipping fees are not refunded unless the item was damaged, defective or wrong.",
  },
  {
    id: "cancellation",
    title: "Order cancellation",
    text: "An order can be cancelled free of charge while its status is Processing. Once an order has Shipped it cannot be cancelled; the customer must wait for delivery and then start a return.",
  },
  {
    id: "shipping",
    title: "Shipping options and times",
    text: "Standard shipping takes 3-5 business days and is free on orders of $50 or more, otherwise $5.99. Express shipping takes 1-2 business days and costs $14.99. ShopNova ships only within the United States and Canada.",
  },
  {
    id: "price-adjustment",
    title: "Price adjustment",
    text: "If ShopNova lowers the price of an item within 14 days of purchase, the customer can request a one-time price adjustment refund of the difference. Price matching with other retailers is not offered.",
  },
  {
    id: "warranty",
    title: "Warranty",
    text: "All electronics carry a 1-year manufacturer warranty from the delivery date. Warranty claims are handled by a human support specialist, who arranges repair or replacement; the support assistant should escalate warranty claims.",
  },
  {
    id: "account-privacy",
    title: "Identity verification and privacy",
    text: "Before sharing any order details or starting a refund, support must verify the customer by matching the order ID with the email address on the order. Never reveal another customer's personal information, address or payment details.",
  },
  {
    id: "contact",
    title: "Human support",
    text: "Human support specialists are available Monday to Friday, 9am-6pm Eastern Time, by phone at 1-800-555-0199 or by escalation from the assistant. Escalated cases receive a reply within 1 business day.",
  },
];

export type OrderItem = {
  sku: string;
  name: string;
  category: "electronics" | "apparel" | "home" | "personal-care" | "gift-card";
  price: number;
  finalSale?: boolean;
  opened?: boolean;
};

export type Order = {
  id: string;
  email: string;
  customerName: string;
  status: "Processing" | "Shipped" | "Delivered" | "Refunded";
  orderedOn: string;
  deliveredOn?: string;
  shipping: "standard" | "express";
  shippingCost: number;
  payment: "card" | "paypal";
  items: OrderItem[];
  damageReportedOn?: string;
};

export const ORDERS: Order[] = [
  {
    id: "SN-1001",
    email: "alice@example.com",
    customerName: "Alice Nguyen",
    status: "Delivered",
    orderedOn: "2026-09-28",
    deliveredOn: "2026-10-02",
    shipping: "standard",
    shippingCost: 0,
    payment: "card",
    items: [{ sku: "AP-220", name: "Merino Wool Sweater", category: "apparel", price: 89 }],
  },
  {
    id: "SN-1002",
    email: "bao@example.com",
    customerName: "Bao Tran",
    status: "Delivered",
    orderedOn: "2026-08-20",
    deliveredOn: "2026-08-25",
    shipping: "standard",
    shippingCost: 0,
    payment: "card",
    items: [{ sku: "HM-510", name: "Ceramic Pour-Over Set", category: "home", price: 64 }],
  },
  {
    id: "SN-1003",
    email: "chloe@example.com",
    customerName: "Chloe Pham",
    status: "Delivered",
    orderedOn: "2026-09-30",
    deliveredOn: "2026-10-03",
    shipping: "express",
    shippingCost: 14.99,
    payment: "paypal",
    items: [
      {
        sku: "EL-901",
        name: "Nova X1 Wireless Headphones",
        category: "electronics",
        price: 199,
        opened: true,
      },
    ],
  },
  {
    id: "SN-1004",
    email: "dan@example.com",
    customerName: "Dan Le",
    status: "Delivered",
    orderedOn: "2026-09-25",
    deliveredOn: "2026-09-29",
    shipping: "standard",
    shippingCost: 0,
    payment: "card",
    items: [
      {
        sku: "AP-777",
        name: "Clearance Rain Jacket",
        category: "apparel",
        price: 45,
        finalSale: true,
      },
    ],
  },
  {
    id: "SN-1005",
    email: "emma@example.com",
    customerName: "Emma Vo",
    status: "Shipped",
    orderedOn: "2026-10-09",
    shipping: "express",
    shippingCost: 14.99,
    payment: "card",
    items: [{ sku: "EL-330", name: "Nova Tab 11 Tablet", category: "electronics", price: 329 }],
  },
  {
    id: "SN-1006",
    email: "felix@example.com",
    customerName: "Felix Do",
    status: "Processing",
    orderedOn: "2026-10-11",
    shipping: "standard",
    shippingCost: 5.99,
    payment: "paypal",
    items: [{ sku: "HM-120", name: "Linen Pillowcase Pair", category: "home", price: 32 }],
  },
  {
    id: "SN-1007",
    email: "gia@example.com",
    customerName: "Gia Hoang",
    status: "Delivered",
    orderedOn: "2026-10-07",
    deliveredOn: "2026-10-11",
    shipping: "standard",
    shippingCost: 0,
    payment: "card",
    damageReportedOn: "2026-10-11",
    items: [{ sku: "HM-640", name: "Glass Table Lamp", category: "home", price: 120 }],
  },
  {
    id: "SN-1008",
    email: "hieu@example.com",
    customerName: "Hieu Bui",
    status: "Refunded",
    orderedOn: "2026-09-01",
    deliveredOn: "2026-09-05",
    shipping: "standard",
    shippingCost: 0,
    payment: "card",
    items: [{ sku: "AP-310", name: "Canvas Sneakers", category: "apparel", price: 75 }],
  },
  {
    id: "SN-1009",
    email: "ivy@example.com",
    customerName: "Ivy Ngo",
    status: "Delivered",
    orderedOn: "2026-09-10",
    deliveredOn: "2026-09-14",
    shipping: "standard",
    shippingCost: 0,
    payment: "card",
    items: [
      { sku: "EL-550", name: "Nova Phone 8", category: "electronics", price: 699, opened: true },
    ],
  },
];
