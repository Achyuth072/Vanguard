import { describe, it } from "node:test";
import assert from "node:assert";
import {
  formatSalary,
  formatSalaryCompact,
  convertCurrency,
  getCurrencySymbol,
  normalizeCurrencyCode,
} from "./currency";

describe("Currency Utilities", () => {
  describe("getCurrencySymbol", () => {
    it("returns correct symbols for standard currencies", () => {
      assert.strictEqual(getCurrencySymbol("INR"), "₹");
      assert.strictEqual(getCurrencySymbol("USD"), "$");
      assert.strictEqual(getCurrencySymbol("EUR"), "€");
      assert.strictEqual(getCurrencySymbol("GBP"), "£");
    });

    it("defaults to INR symbol when omitted", () => {
      assert.strictEqual(getCurrencySymbol(), "₹");
    });
  });

  describe("convertCurrency", () => {
    it("returns original amount when currencies match", () => {
      assert.strictEqual(convertCurrency(100000, "INR", "INR"), 100000);
      assert.strictEqual(convertCurrency(5000, "USD", "USD"), 5000);
    });

    it("converts USD to INR accurately", () => {
      // 100,000 USD * 85 = 8,500,000 INR
      assert.strictEqual(convertCurrency(100000, "USD", "INR"), 8500000);
    });

    it("converts INR to USD accurately", () => {
      // 8,500,000 INR / 85 = 100,000 USD
      assert.strictEqual(convertCurrency(8500000, "INR", "USD"), 100000);
    });

    it("converts EUR to INR accurately", () => {
      // 10,000 EUR * 92 = 920,000 INR
      assert.strictEqual(convertCurrency(10000, "EUR", "INR"), 920000);
    });

    it("returns null for unsupported currencies", () => {
      assert.strictEqual(convertCurrency(1000, "XYZ", "INR"), null);
    });
  });

  describe("formatSalary", () => {
    it("formats INR with Indian rupee symbol and comma grouping", () => {
      const formatted = formatSalary(1500000, "INR");
      assert.ok(formatted.includes("15,00,000") || formatted.includes("1,500,000"));
      assert.ok(formatted.includes("₹") || formatted.includes("INR"));
    });

    it("formats USD with dollar sign", () => {
      const formatted = formatSalary(120000, "USD");
      assert.ok(formatted.includes("$") || formatted.includes("USD"));
      assert.ok(formatted.includes("120,000"));
    });
  });

  describe("formatSalaryCompact", () => {
    it("formats INR in Lakhs and Crores", () => {
      assert.strictEqual(formatSalaryCompact(1500000, "INR"), "₹15L");
      assert.strictEqual(formatSalaryCompact(1550000, "INR"), "₹15.5L");
      assert.strictEqual(formatSalaryCompact(20000000, "INR"), "₹2Cr");
      assert.strictEqual(formatSalaryCompact(50000, "INR"), "₹50k");
    });

    it("formats USD in k and M", () => {
      assert.strictEqual(formatSalaryCompact(120000, "USD"), "$120k");
      assert.strictEqual(formatSalaryCompact(1500000, "USD"), "$1.5M");
    });
  });

  describe("normalizeCurrencyCode", () => {
    it("normalizes rupee symbols, abbreviations, and words to INR", () => {
      assert.strictEqual(normalizeCurrencyCode("₹"), "INR");
      assert.strictEqual(normalizeCurrencyCode("Rs"), "INR");
      assert.strictEqual(normalizeCurrencyCode("Rs."), "INR");
      assert.strictEqual(normalizeCurrencyCode("Rupees"), "INR");
      assert.strictEqual(normalizeCurrencyCode("LPA"), "INR");
      assert.strictEqual(normalizeCurrencyCode("Lakhs"), "INR");
    });

    it("normalizes dollar symbols and words to USD", () => {
      assert.strictEqual(normalizeCurrencyCode("$"), "USD");
      assert.strictEqual(normalizeCurrencyCode("USD"), "USD");
      assert.strictEqual(normalizeCurrencyCode("Dollars"), "USD");
    });

    it("normalizes euro and pound symbols to EUR and GBP", () => {
      assert.strictEqual(normalizeCurrencyCode("€"), "EUR");
      assert.strictEqual(normalizeCurrencyCode("Euros"), "EUR");
      assert.strictEqual(normalizeCurrencyCode("£"), "GBP");
      assert.strictEqual(normalizeCurrencyCode("Pounds"), "GBP");
    });
  });
});
