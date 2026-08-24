import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { BM25Scorer } from "./bm25";

describe("BM25Scorer Lexical Engine", () => {
  test("tokenizes technical compounds and punctuation correctly", () => {
    const scorer = new BM25Scorer();

    const tokens = scorer.tokenize("Looking for Node.js, C++, TypeScript, and .NET Core engineer!");
    assert.ok(tokens.includes("node_js"));
    assert.ok(tokens.includes("cpp"));
    assert.ok(tokens.includes("typescript"));
    assert.ok(tokens.includes("net"));
    assert.ok(tokens.includes("core"));
    assert.ok(tokens.includes("engineer"));
  });

  test("handles empty and edge case inputs safely", () => {
    const scorer = new BM25Scorer();
    assert.deepEqual(scorer.tokenize(""), []);
    assert.deepEqual(scorer.fit([]), { totalDocs: 0, avgDocLength: 0 });
    assert.equal(scorer.scoreDocument([], ""), 0);
    assert.equal(scorer.scoreDocument(["react"], ""), 0);
    assert.equal(scorer.scoreDocument([], "Senior Software Engineer"), 0);
    assert.equal(scorer.scoreNormalized([], "Senior Software Engineer"), 0);
  });

  test("scores documents higher when matching rare keywords", () => {
    const scorer = new BM25Scorer();
    const corpus = [
      "We are building modern web applications using React, TypeScript, TailwindCSS, and Next.js.",
      "General software engineering role for distributed backend microservices.",
      "Data pipeline engineer using ClickHouse, Apache Kafka, and Rust for high-throughput streaming.",
    ];

    scorer.fit(corpus);

    // Query for specialized data pipeline tech
    const scoreClickHouse = scorer.scoreDocument("ClickHouse Kafka Rust", corpus[2]);
    const scoreReactJob = scorer.scoreDocument("ClickHouse Kafka Rust", corpus[0]);

    assert.ok(scoreClickHouse > 0, "Should have positive score for matching document");
    assert.equal(scoreReactJob, 0, "Should have zero score for document with no matching keywords");
    assert.ok(scoreClickHouse > scoreReactJob);
  });

  test("normalizes scores between 0 and 100", () => {
    const scorer = new BM25Scorer();
    const corpus = [
      "Senior Full-Stack Engineer: React, TypeScript, Node.js, PostgreSQL, GraphQL",
      "Junior Frontend Developer: HTML, CSS, JavaScript",
    ];
    scorer.fit(corpus);

    const query = "React TypeScript Node.js PostgreSQL GraphQL";
    const normScore1 = scorer.scoreNormalized(query, corpus[0]);
    const normScore2 = scorer.scoreNormalized(query, corpus[1]);

    assert.ok(normScore1 >= 80, `Expected high match (>= 80), got ${normScore1}`);
    assert.ok(normScore2 < 30, `Expected low match (< 30), got ${normScore2}`);
  });

  test("extracts matched keywords correctly", () => {
    const scorer = new BM25Scorer();
    const doc = "Must have 5+ years of React, Next.js, and TypeScript experience.";
    const query = ["react", "vue", "typescript", "python"];

    const matched = scorer.getMatchedKeywords(query, doc);
    assert.ok(matched.includes("react"));
    assert.ok(matched.includes("typescript"));
    assert.ok(!matched.includes("vue"));
    assert.ok(!matched.includes("python"));
  });
});
