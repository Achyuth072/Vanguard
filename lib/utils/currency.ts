export const SUPPORTED_CURRENCIES = [
  { code: "INR", symbol: "₹", label: "INR (₹) - Indian Rupee" },
  { code: "USD", symbol: "$", label: "USD ($) - US Dollar" },
  { code: "EUR", symbol: "€", label: "EUR (€) - Euro" },
  { code: "GBP", symbol: "£", label: "GBP (£) - British Pound" },
  { code: "CAD", symbol: "CA$", label: "CAD ($) - Canadian Dollar" },
  { code: "AUD", symbol: "A$", label: "AUD ($) - Australian Dollar" },
  { code: "SGD", symbol: "S$", label: "SGD ($) - Singapore Dollar" },
  { code: "AED", symbol: "AED", label: "AED (AED) - UAE Dirham" },
  { code: "CHF", symbol: "CHF", label: "CHF (CHF) - Swiss Franc" },
  { code: "JPY", symbol: "¥", label: "JPY (¥) - Japanese Yen" },
  { code: "SEK", symbol: "kr", label: "SEK (kr) - Swedish Krona" },
  { code: "NZD", symbol: "NZ$", label: "NZD ($) - New Zealand Dollar" },
  { code: "HKD", symbol: "HK$", label: "HKD ($) - Hong Kong Dollar" },
  { code: "BRL", symbol: "R$", label: "BRL (R$) - Brazilian Real" },
  { code: "PLN", symbol: "zł", label: "PLN (zł) - Polish Zloty" },
  { code: "ZAR", symbol: "R", label: "ZAR (R) - South African Rand" },
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
  AED: 23.1,
  CHF: 95.5,
  JPY: 0.57,
  SEK: 8.0,
  NZD: 50.5,
  HKD: 10.9,
  BRL: 15.0,
  PLN: 21.5,
  ZAR: 4.6,
};

export function getCurrencySymbol(currency: string = "INR"): string {
  const upper = (currency || "INR").toUpperCase();
  const match = SUPPORTED_CURRENCIES.find((c) => c.code === upper);
  return match?.symbol || upper;
}

/**
 * Normalizes currency symbols, spelled-out words, or abbreviations into canonical ISO-4217 codes.
 */
export function normalizeCurrencyCode(input?: string | null): string {
  if (!input) return "INR";
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();

  if (["INR", "₹", "RS", "RS.", "RUPEE", "RUPEES", "LPA", "LAKH", "LAKHS", "CR", "CRORE"].includes(upper)) {
    return "INR";
  }
  if (["USD", "$", "DOLLAR", "DOLLARS", "US$", "USD$"].includes(upper)) {
    return "USD";
  }
  if (["EUR", "€", "EURO", "EUROS"].includes(upper)) {
    return "EUR";
  }
  if (["GBP", "£", "POUND", "POUNDS", "STERLING"].includes(upper)) {
    return "GBP";
  }
  if (["CAD", "CA$", "CANADIAN DOLLAR", "CANADIAN DOLLARS"].includes(upper)) {
    return "CAD";
  }
  if (["AUD", "A$", "AUSTRALIAN DOLLAR", "AUSTRALIAN DOLLARS"].includes(upper)) {
    return "AUD";
  }
  if (["SGD", "S$", "SINGAPORE DOLLAR", "SINGAPORE DOLLARS"].includes(upper)) {
    return "SGD";
  }
  if (["AED", "DIRHAM", "DIRHAMS", "DH", "DHS"].includes(upper)) {
    return "AED";
  }
  if (["CHF", "SWISS FRANC", "SWISS FRANCS", "FRANC", "FRANCS"].includes(upper)) {
    return "CHF";
  }
  if (["JPY", "¥", "YEN", "JAPANESE YEN"].includes(upper)) {
    return "JPY";
  }
  if (["SEK", "KR", "KRONA", "KRONOR", "SWEDISH KRONA"].includes(upper)) {
    return "SEK";
  }
  if (["NZD", "NZ$", "NEW ZEALAND DOLLAR", "KIWI DOLLAR"].includes(upper)) {
    return "NZD";
  }
  if (["HKD", "HK$", "HONG KONG DOLLAR"].includes(upper)) {
    return "HKD";
  }
  if (["BRL", "R$", "REAL", "REAIS", "BRAZILIAN REAL"].includes(upper)) {
    return "BRL";
  }
  if (["PLN", "ZŁ", "ZL", "ZLOTY", "POLISH ZLOTY"].includes(upper)) {
    return "PLN";
  }
  if (["ZAR", "RAND", "SOUTH AFRICAN RAND"].includes(upper)) {
    return "ZAR";
  }

  return upper.length === 3 ? upper : "INR";
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
  const localeMap: Record<string, string> = {
    INR: "en-IN",
    USD: "en-US",
    EUR: "de-DE",
    GBP: "en-GB",
    CAD: "en-CA",
    AUD: "en-AU",
    SGD: "en-SG",
    AED: "en-AE",
    CHF: "de-CH",
    JPY: "ja-JP",
    SEK: "sv-SE",
    NZD: "en-NZ",
    HKD: "zh-HK",
    BRL: "pt-BR",
    PLN: "pl-PL",
    ZAR: "en-ZA",
  };
  const locale = localeMap[curr] || "en-US";

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
  const curr = (typeof currency === "string" && currency ? currency : "INR").toUpperCase();
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

  if (curr === "JPY") {
    if (amount >= 10000) {
      const man = amount / 10000;
      return `${symbol}${man % 1 === 0 ? man.toFixed(0) : man.toFixed(1)}万`;
    }
    return `${symbol}${amount.toLocaleString()}`;
  }

  if (amount >= 1000000) {
    const m = amount / 1000000;
    return `${symbol}${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (amount >= 1000) {
    const k = amount / 1000;
    return `${symbol}${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `${symbol}${amount}`;
}

/**
 * Formats a salary range compactly (e.g. ₹15L–₹25L, $80k–$110k).
 */
export function formatSalaryRange(
  min?: number | null,
  max?: number | null,
  currency: string = "INR"
): string | null {
  if ((min === null || min === undefined) && (max === null || max === undefined)) {
    return null;
  }

  const curr = typeof currency === "string" && currency ? currency : "INR";

  if (min && max) {
    if (min === max) return formatSalaryCompact(min, curr);
    return `${formatSalaryCompact(min, curr)}–${formatSalaryCompact(max, curr)}`;
  }
  if (min) return `${formatSalaryCompact(min, curr)}+`;
  if (max) return `Up to ${formatSalaryCompact(max, curr)}`;
  return null;
}
