// The limits below are the ones apps/api/app/billing/repository.py actually enforces (documents,
// storage bytes, key count, API requests/day, chat messages/day). Nothing else is gated per tier,
// so a pricing page built from this file must not add feature rows that no code checks.
export type PricingTier = {
  tier: "free" | "pro" | "enterprise";
  priceMonthly: number;
  priceYearly: number;
  limits: {
    documents: number;
    storageBytes: number;
    apiKeys: number;
    apiRequestsPerDay: number;
    chatMessagesPerDay: number;
  };
};

export const PRICING_TIERS: PricingTier[] = [
  {
    tier: "free",
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      documents: 10,
      storageBytes: 100 * 1024 * 1024,
      apiKeys: 2,
      apiRequestsPerDay: 100,
      chatMessagesPerDay: 50,
    },
  },
  {
    tier: "pro",
    priceMonthly: 29,
    priceYearly: 290,
    limits: {
      documents: 500,
      storageBytes: 10 * 1024 * 1024 * 1024,
      apiKeys: 10,
      apiRequestsPerDay: 10_000,
      chatMessagesPerDay: 1_000,
    },
  },
  {
    tier: "enterprise",
    priceMonthly: 99,
    priceYearly: 990,
    limits: {
      documents: 10_000,
      storageBytes: 100 * 1024 * 1024 * 1024,
      apiKeys: 100,
      apiRequestsPerDay: 100_000,
      chatMessagesPerDay: 10_000,
    },
  },
];

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

export function formatStorage(bytes: number): string {
  if (bytes >= GIB && bytes % GIB === 0) return `${bytes / GIB} GB`;
  if (bytes >= MIB) return `${Math.round(bytes / MIB)} MB`;
  return `${bytes} B`;
}

export function formatUsd(amount: number): string {
  return `$${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}
