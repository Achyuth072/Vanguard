import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { estimateTokens, stripJobBoilerplate, truncateToTokenBudget } from "./tokenizer";

describe("Token Budgeting & Distillation Utilities", () => {
  test("estimates tokens accurately on short and long strings", () => {
    assert.equal(estimateTokens(""), 0);
    assert.equal(estimateTokens("   "), 0);
    assert.equal(estimateTokens("Hello World"), 3); // 11 chars / 3.8 = ~3
    const longText = "a".repeat(380);
    assert.equal(estimateTokens(longText), 100);
  });

  test("strips standard EEO, affirmative action, and agency disclaimers", () => {
    const rawJob = `
# Staff Distributed Systems Engineer

Responsibilities:
- Build high-throughput Kafka streaming pipelines.
- Architect resilient ClickHouse analytical stores.

Requirements:
- 5+ years Go and Rust experience.
- Strong knowledge of Raft or Paxos consensus.

Equal Opportunity Employer:
We are an equal employment opportunity employer. All qualified applicants will receive consideration for employment without regard to race, color, religion, sex, sexual orientation, gender identity, national origin, disability, or status as a protected veteran.

To all recruitment agencies: We do not accept unsolicited agency resumes.
`;

    const cleaned = stripJobBoilerplate(rawJob);
    assert.ok(cleaned.includes("Staff Distributed Systems Engineer"));
    assert.ok(cleaned.includes("5+ years Go and Rust experience"));
    assert.ok(!cleaned.includes("All qualified applicants will receive consideration"));
    assert.ok(!cleaned.includes("To all recruitment agencies"));
  });

  test("truncates safely to token budget without cutting mid-sentence if possible", () => {
    const text = "First sentence here. Second sentence with details. Third sentence goes further.";
    const truncated = truncateToTokenBudget(text, 10); // ~38 chars budget

    assert.ok(truncated.length <= 45);
    assert.ok(truncated.endsWith("."));
  });
});
