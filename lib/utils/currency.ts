export const SUPPORTED_CURRENCIES = [
  { code: "INR", symbol: "₹", label: "INR (₹) - Indian Rupee" },
  { code: "USD", symbol: "$", label: "USD ($) - US Dollar" },
  { code: "EUR", symbol: "€", label: "EUR (€) - Euro" },
  { code: "GBP", symbol: "£", label: "GBP (£) - British Pound" },
  { code: "CAD", symbol: "CA$", label: "CAD ($) - Canadian Dollar" },
  { code: "AUD", symbol: "A$", label: "AUD ($) - Australian Dollar" },
  { code: "SGD", symbol: "S$", label: "SGD ($) - Singapore Dollar" },
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

/**
 * Static baseline exchange rates against INR for offline deterministic filtering.
 */
export const STATIC_EXCHANGE_RATES_TO_INR: Record<string, number> = {
  INR: 1,
  USD: 85,
  EUR: 92,
  GBP: 110,
  CAD: 62,
  AUD: 55,
  SGD: 63,
};

export function getCurrencySymbol(currency: string = "INR"): string {
  const upper = (currency || "INR").toUpperCase();
  const match = SUPPORTED_CURRENCIES.find((c) => c.code === upper);
  return match?.symbol || upper;
}

/**
 * Converts an amount from one currency to another using static reference rates.
 * Returns null if either currency is unsupported.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string = "INR",
  toCurrency: string = "INR"
): number | null {
  const from = (fromCurrency || "INR").toUpperCase();
  const to = (toCurrency || "INR").toUpperCase();

  if (from === to) {
    return amount;
  }

  const fromRate = STATIC_EXCHANGE_RATES_TO_INR[from];
  const toRate = STATIC_EXCHANGE_RATES_TO_INR[to];

  if (!fromRate || !toRate) {
    return null;
  }

  const amountInInr = amount * fromRate;
  const converted = amountInInr / toRate;
  return Math.round(converted);
}

/**
 * Formats a salary amount with currency symbol and appropriate locale separators.
 */
export function formatSalary(amount: number, currency: string = "INR"): string {
  const curr = (currency || "INR").toUpperCase();
  const locale = curr === "INR" ? "en-IN" : "en-US";

  try {
    return amount.toLocaleString(locale, {
      style: "currency",
      currency: curr,
      maximumFractionDigits: 0,
    });
  } catch {
    return `${curr} ${amount.toLocaleString()}`;
  }
}

/**
 * Formats a compact salary string for badges and cards (e.g. ₹15L, $120k).
 */
export function formatSalaryCompact(amount: number, currency: string = "INR"): string {
  const curr = (currency || "INR").toUpperCase();
  const symbol = getCurrencySymbol(curr);

  if (curr === "INR") {
    if (amount >= 10000000) {
      const cr = amount / 10000000;
      return `${symbol}${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
    }
    if (amount >= 100000) {
      const l = amount / 100000;
      return `${symbol}${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)}L`;
    }
    return `${symbol}${(amount / 1000).toFixed(0)}k`;
  }

  if (amount >= 1000000) {
    const m = amount / 1000000;
    return `${symbol}${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  return `${symbol}${(amount / 1000).toFixed(0)}k`;
}
