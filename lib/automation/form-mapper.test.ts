import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { LanguageModel } from "ai";
import {
  splitFullName,
  composeFullName,
  normalizePhoneE164,
  extractFormFieldsFromHtml,
  mapFormFromHtml,
  matchTier2Semantic,
  generateInPageExtractorScript,
} from "./form-mapper";
import type { CandidateProfilePayload } from "./types";

test("Two-Tiered ATS Form Field Mapper", async (t) => {
  const fixturesDir = path.resolve(process.cwd(), ".scratch/phase-3/fixtures");
  const greenhouseHtml = fs.readFileSync(
    path.join(fixturesDir, "greenhouse-application.html"),
    "utf-8"
  );
  const leverHtml = fs.readFileSync(
    path.join(fixturesDir, "lever-application.html"),
    "utf-8"
  );
  const ashbyHtml = fs.readFileSync(
    path.join(fixturesDir, "ashby-application.html"),
    "utf-8"
  );
  const candidatePayload: CandidateProfilePayload = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, "candidate-profile.json"), "utf-8")
  );
  const expectedMappings = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, "expected-mappings.json"), "utf-8")
  );

  await t.test("Name composition and splitting utilities", () => {
    // Standard two-word name
    assert.deepEqual(splitFullName("Alex Rivera"), {
      firstName: "Alex",
      lastName: "Rivera",
    });

    // Multi-word name
    assert.deepEqual(splitFullName("Alex John Rivera"), {
      firstName: "Alex",
      lastName: "John Rivera",
    });

    // Single word name
    assert.deepEqual(splitFullName("Cher"), {
      firstName: "Cher",
      lastName: "",
    });

    // Empty and whitespace input
    assert.deepEqual(splitFullName(""), { firstName: "", lastName: "" });
    assert.deepEqual(splitFullName("   "), { firstName: "", lastName: "" });

    // Composition
    assert.equal(composeFullName("Alex", "Rivera"), "Alex Rivera");
    assert.equal(composeFullName("Alex", ""), "Alex");
    assert.equal(composeFullName("", "Rivera"), "Rivera");
    assert.equal(composeFullName("", ""), "");
  });

  await t.test("Phone number E.164 normalization", () => {
    // Formatted US phone number
    assert.equal(normalizePhoneE164("+1 (415) 555-0199"), "+14155550199");
    assert.equal(normalizePhoneE164("(415) 555-0199"), "+14155550199");
    assert.equal(normalizePhoneE164("415-555-0199"), "+14155550199");
    assert.equal(normalizePhoneE164("4155550199"), "+14155550199");
    assert.equal(normalizePhoneE164("14155550199"), "+14155550199");

    // Already E.164 or international
    assert.equal(normalizePhoneE164("+44 7911 123456"), "+447911123456");
    assert.equal(normalizePhoneE164(""), "");
  });

  await t.test("HTML DOM Extractor extracts normalized interactive field schemas", () => {
    // Greenhouse
    const ghExtracted = extractFormFieldsFromHtml(greenhouseHtml);
    assert.equal(ghExtracted.platform, "greenhouse");
    assert.equal(ghExtracted.formSelector, "#application_form");
    assert.ok(ghExtracted.fields.length >= 14);

    const ghFirstName = ghExtracted.fields.find((f) => f.id === "first_name");
    assert.ok(ghFirstName);
    assert.equal(ghFirstName.autocomplete, "given-name");
    assert.equal(ghFirstName.required, true);

    // Lever
    const leverExtracted = extractFormFieldsFromHtml(leverHtml);
    assert.equal(leverExtracted.platform, "lever");
    assert.equal(leverExtracted.formSelector, "form#application-form");
    assert.ok(leverExtracted.fields.length >= 12);

    const leverName = leverExtracted.fields.find((f) => f.name === "name");
    assert.ok(leverName);
    assert.equal(leverName.autocomplete, "name");

    // Ashby
    const ashbyExtracted = extractFormFieldsFromHtml(ashbyHtml);
    assert.equal(ashbyExtracted.platform, "ashby");
    assert.equal(ashbyExtracted.formSelector, "#_ashby_application_form");
    assert.ok(ashbyExtracted.fields.length >= 12);

    const ashbyResume = ashbyExtracted.fields.find(
      (f) => f.testId === "resume-file-input"
    );
    assert.ok(ashbyResume);
    assert.equal(ashbyResume.type, "file");
  });

  await t.test("100% field mapping accuracy on Greenhouse fixture", async () => {
    const outcome = await mapFormFromHtml(greenhouseHtml, candidatePayload);
    assert.equal(outcome.platform, "greenhouse");
    assert.equal(outcome.formSelector, "#application_form");

    const expectedList = expectedMappings.greenhouse.expectedMappings;

    for (const exp of expectedList) {
      const found = outcome.mappedFields.find((m) => m.selector === exp.selector);
      assert.ok(
        found,
        `Expected selector '${exp.selector}' to be mapped for Greenhouse (${exp.field})`
      );
      assert.equal(found.tier, exp.tier, `Tier mismatch for ${exp.field}`);
      assert.equal(
        found.matchType,
        exp.matchType,
        `MatchType mismatch for ${exp.field}`
      );

      if (exp.expectedValue) {
        assert.equal(
          found.value,
          exp.expectedValue,
          `Value mismatch for ${exp.field}`
        );
      }
      if (exp.expectedAnswerCategory) {
        assert.equal(
          found.expectedAnswerCategory,
          exp.expectedAnswerCategory,
          `Category mismatch for ${exp.field}`
        );
      }
    }
  });

  await t.test("100% field mapping accuracy on Lever fixture", async () => {
    const outcome = await mapFormFromHtml(leverHtml, candidatePayload);
    assert.equal(outcome.platform, "lever");
    assert.equal(outcome.formSelector, "form#application-form");

    const expectedList = expectedMappings.lever.expectedMappings;

    for (const exp of expectedList) {
      const found = outcome.mappedFields.find((m) => m.selector === exp.selector);
      assert.ok(
        found,
        `Expected selector '${exp.selector}' to be mapped for Lever (${exp.field})`
      );
      assert.equal(found.tier, exp.tier, `Tier mismatch for ${exp.field}`);
      assert.equal(
        found.matchType,
        exp.matchType,
        `MatchType mismatch for ${exp.field}`
      );

      if (exp.expectedValue) {
        assert.equal(
          found.value,
          exp.expectedValue,
          `Value mismatch for ${exp.field}`
        );
      }
      if (exp.expectedAction) {
        assert.equal(
          found.action,
          exp.expectedAction,
          `Action mismatch for ${exp.field}`
        );
      }
      if (exp.expectedAnswerCategory) {
        assert.equal(
          found.expectedAnswerCategory,
          exp.expectedAnswerCategory,
          `Category mismatch for ${exp.field}`
        );
      }
    }
  });

  await t.test("100% field mapping accuracy on Ashby fixture", async () => {
    const outcome = await mapFormFromHtml(ashbyHtml, candidatePayload);
    assert.equal(outcome.platform, "ashby");
    assert.equal(outcome.formSelector, "#_ashby_application_form");

    const expectedList = expectedMappings.ashby.expectedMappings;

    for (const exp of expectedList) {
      const found = outcome.mappedFields.find((m) => m.selector === exp.selector);
      assert.ok(
        found,
        `Expected selector '${exp.selector}' to be mapped for Ashby (${exp.field})`
      );
      assert.equal(found.tier, exp.tier, `Tier mismatch for ${exp.field}`);
      assert.equal(
        found.matchType,
        exp.matchType,
        `MatchType mismatch for ${exp.field}`
      );

      if (exp.expectedValue) {
        assert.equal(
          found.value,
          exp.expectedValue,
          `Value mismatch for ${exp.field}`
        );
      }
      if (exp.expectedAnswerCategory) {
        assert.equal(
          found.expectedAnswerCategory,
          exp.expectedAnswerCategory,
          `Category mismatch for ${exp.field}`
        );
      }
    }
  });

  await t.test("Tier 2 LLM semantic fallback with AIRouter synthesis", async () => {
    const customField = {
      id: "leadership_philosophy",
      selector: "textarea#custom_q1",
      label: "What is your approach to technical mentorship and distributed team alignment?",
      type: "textarea" as const,
      required: true,
    };

    // Synthesize answer using mocked AI provider
    const outcome = await matchTier2Semantic(customField, candidatePayload, {
      synthesizeCustomAnswers: true,
      jobContext: {
        title: "Staff Distributed Systems Engineer",
        company: "Starlight",
        description: "Scaling high-throughput microservices.",
      },
      aiOptions: {
        primaryModel: {
          specificationVersion: "v2",
          provider: "mock",
          modelId: "mock-model",
          supportedUrls: {},
          async doGenerate() {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    id: "ans-1",
                    question: customField.label,
                    answer:
                      "I emphasize blameless post-mortems, pairing, and written architectural RFCs.",
                    keyPointsUsed: ["Mentorship", "RFCs"],
                    createdAt: "2026-08-18T00:00:00.000Z",
                  }),
                },
              ],
              finishReason: "stop" as const,
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          },
          async doStream() {
            throw new Error("Not implemented");
          },
        } as unknown as LanguageModel,
      },
    });

    assert.ok(outcome);
    assert.equal(outcome.tier, 2);
    assert.equal(outcome.matchType, "llm-semantic");
    assert.equal(
      outcome.value,
      "I emphasize blameless post-mortems, pairing, and written architectural RFCs."
    );
  });

  await t.test("Generates valid in-page browser extractor script string", () => {
    const script = generateInPageExtractorScript();
    assert.ok(typeof script === "string");
    assert.ok(script.includes("document.querySelectorAll"));
    assert.ok(script.includes("data-testid"));
  });
});
