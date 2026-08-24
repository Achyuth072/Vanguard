/**
 * High-performance, zero-dependency Okapi BM25 lexical scorer tailored for technical resumes and job postings.
 * Handles specialized technical keywords (e.g. C++, C#, .NET, Node.js, React.js, Next.js, CI/CD, Go, R).
 */

export interface BM25Options {
  k1?: number;
  b?: number;
}

export interface BM25DocStats {
  totalDocs: number;
  avgDocLength: number;
}

export class BM25Scorer {
  private k1: number;
  private b: number;
  private idfMap: Map<string, number> = new Map();
  private avgDocLength: number = 0;
  private totalDocs: number = 0;

  constructor(options?: BM25Options) {
    this.k1 = options?.k1 ?? 1.5;
    this.b = options?.b ?? 0.75;
  }

  /**
   * Tokenizes text into normalized terms while preserving technical compounds.
   * e.g. "C++", "C#", ".NET", "Node.js", "React-Native", "CI/CD", "TypeScript", "Go", "R", "C".
   */
  public tokenize(text: string): string[] {
    if (!text || typeof text !== "string") return [];

    const cleaned = text
      .toLowerCase()
      // Preserve .net, node.js, vue.js, react.js, next.js
      .replace(/([a-z0-9])\.(js|net|ts|io|ai|org|com)\b/g, "$1_$2")
      // Normalize c++, c#, f# to unambiguous single tokens
      .replace(/\bc\+\+/g, "cpp")
      .replace(/\bc#/g, "csharp")
      .replace(/\bf#/g, "fsharp")
      // Replace symbols except underscores with space
      .replace(/[^\w\s_]/g, " ");

    return cleaned
      .split(/\s+/)
      .map((term) => term.trim())
      .filter((term) => term.length >= 1);
  }

  /**
   * Fits the BM25 model across a corpus of documents to calculate IDF values and average document length.
   */
  public fit(documents: string[]): BM25DocStats {
    this.totalDocs = documents.length;
    this.idfMap.clear();
    this.avgDocLength = 0;

    if (this.totalDocs === 0) {
      return { totalDocs: 0, avgDocLength: 0 };
    }

    let totalTokens = 0;
    const docFrequencies = new Map<string, number>();

    for (let i = 0; i < documents.length; i++) {
      const tokens = this.tokenize(documents[i]);
      totalTokens += tokens.length;

      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        docFrequencies.set(token, (docFrequencies.get(token) ?? 0) + 1);
      }
    }

    this.avgDocLength = totalTokens / this.totalDocs;

    // Standard Lucene/Okapi smoothed IDF formula: ln(1 + (N - n + 0.5) / (n + 0.5))
    for (const [term, df] of docFrequencies.entries()) {
      const idf = Math.log(1 + (this.totalDocs - df + 0.5) / (df + 0.5));
      this.idfMap.set(term, Math.max(0.1, idf));
    }

    return {
      totalDocs: this.totalDocs,
      avgDocLength: this.avgDocLength,
    };
  }

  /**
   * Calculates the BM25 score of a document against query terms.
   */
  public scoreDocument(queryTokens: string[] | string, docText: string): number {
    const tokens = Array.isArray(queryTokens) ? queryTokens : this.tokenize(queryTokens);
    if (tokens.length === 0 || !docText) return 0;

    const docTokens = this.tokenize(docText);
    const docLength = docTokens.length;
    if (docLength === 0) return 0;

    const effectiveAvgLength = this.avgDocLength > 0 ? this.avgDocLength : docLength;

    // Count term frequencies in doc
    const termFreq = new Map<string, number>();
    for (const token of docTokens) {
      termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
    }

    let score = 0;
    for (const q of tokens) {
      const tf = termFreq.get(q) ?? 0;
      if (tf > 0) {
        const idf = this.idfMap.get(q) ?? Math.max(0.1, Math.log(1 + (this.totalDocs + 0.5) / 1.5));
        const numerator = tf * (this.k1 + 1);
        const denominator = tf + this.k1 * (1 - this.b + this.b * (docLength / effectiveAvgLength));
        score += idf * (numerator / denominator);
      }
    }

    return Math.max(0, score);
  }

  /**
   * Scores a document and returns a normalized percentage score (0–100)
   * based on the ratio of matched query terms weighted by IDF.
   */
  public scoreNormalized(queryTokens: string[] | string, docText: string): number {
    const tokens = Array.isArray(queryTokens) ? queryTokens : this.tokenize(queryTokens);
    if (tokens.length === 0 || !docText) return 0;

    const uniqueQueryTokens = Array.from(new Set(tokens));
    const docTokens = new Set(this.tokenize(docText));

    let matchedWeight = 0;
    let totalWeight = 0;

    for (const q of uniqueQueryTokens) {
      const idf = this.idfMap.get(q) ?? 1.0;
      totalWeight += idf;
      if (docTokens.has(q)) {
        matchedWeight += idf;
      }
    }

    if (totalWeight <= 0) return 0;

    const rawBM25 = this.scoreDocument(tokens, docText);
    const matchRatio = matchedWeight / totalWeight;

    // Combine term coverage ratio (70%) and BM25 density score (30%)
    const compositeRatio = 0.7 * matchRatio + 0.3 * Math.min(1.0, rawBM25 / (uniqueQueryTokens.length * 1.5));
    return Math.min(100, Math.max(0, Math.round(compositeRatio * 100)));
  }

  /**
   * Returns matching keywords between query and document.
   */
  public getMatchedKeywords(query: string[] | string, docText: string): string[] {
    const qTokens = new Set(Array.isArray(query) ? query : this.tokenize(query));
    const docTokens = new Set(this.tokenize(docText));
    const matched: string[] = [];

    for (const q of qTokens) {
      if (docTokens.has(q)) {
        matched.push(q);
      }
    }

    return matched;
  }
}
