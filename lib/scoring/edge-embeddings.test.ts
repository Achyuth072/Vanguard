import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EdgeEmbeddingEngine, edgeEmbedder } from "./edge-embeddings";

describe("Edge ONNX Dense Embeddings Service", () => {
  it("generates a 384-dimensional vector for query and passage text", async () => {
    const queryVec = await edgeEmbedder.embed("React TypeScript Next.js frontend development", true);
    assert.equal(queryVec.length, 384);

    const passageVec = await edgeEmbedder.embed(
      "We are seeking a Senior Frontend Engineer proficient in React, Next.js, and TypeScript.",
      false
    );
    assert.equal(passageVec.length, 384);
  });

  it("handles empty or whitespace-only input safely", async () => {
    const emptyVec = await edgeEmbedder.embed("");
    assert.equal(emptyVec.length, 384);
    assert.equal(emptyVec.every((v) => v === 0), true);

    const whitespaceVec = await edgeEmbedder.embed("   ");
    assert.equal(whitespaceVec.length, 384);
  });

  it("calculates cosine similarity accurately between vectors", () => {
    const engine = new EdgeEmbeddingEngine();
    const vecA = new Float32Array([1, 0, 0]);
    const vecB = new Float32Array([1, 0, 0]);
    const vecC = new Float32Array([0, 1, 0]);

    assert.equal(engine.cosineSimilarity(vecA, vecB), 1.0);
    assert.equal(engine.cosineSimilarity(vecA, vecC), 0.0);
  });

  it("produces higher similarity for semantically related texts than unrelated texts", async () => {
    const query = "Distributed Systems PostgreSQL Kafka ClickHouse";
    const relevantJob = "Backend infrastructure engineer working on distributed data pipelines using Kafka, PostgreSQL, and ClickHouse";
    const irrelevantJob = "Registered nurse ICU clinical hospital patient care cardiology";

    const queryVec = await edgeEmbedder.embed(query, true);
    const relVec = await edgeEmbedder.embed(relevantJob, false);
    const irrelVec = await edgeEmbedder.embed(irrelevantJob, false);

    const relSim = edgeEmbedder.cosineSimilarity(queryVec, relVec);
    const irrelSim = edgeEmbedder.cosineSimilarity(queryVec, irrelVec);

    assert.ok(relSim > irrelSim, `Expected relevant similarity (${relSim}) to exceed irrelevant similarity (${irrelSim})`);
    assert.ok(relSim > 0.3, `Expected relevant similarity to be reasonably high (got ${relSim})`);
  });
});
