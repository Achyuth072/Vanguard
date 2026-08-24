/**
 * Lightweight token budgeting, estimation, and prompt distillation utilities.
 * Reduces token consumption on free-tier LLMs by removing legal boilerplates and EEO statements.
 */

const EEO_BOILERPLATE_PATTERNS = [
  /(?:we\s+are\s+an?\s+)?equal\s+(?:opportunity|employment)\s+employer[\s\S]*?(?=(?:\n\s*\n|#|$))/i,
  /all\s+qualified\s+applicants\s+will\s+receive\s+consideration\s+for\s+employment[\s\S]*?(?=(?:\n\s*\n|#|$))/i,
  /affirmative\s+action\s+employer[\s\S]*?(?=(?:\n\s*\n|#|$))/i,
  /we\s+do\s+not\s+discriminate\s+on\s+the\s+basis\s+of\s+race[\s\S]*?(?=(?:\n\s*\n|#|$))/i,
  /san\s+francisco\s+fair\s+chance\s+ordinance[\s\S]*?(?=(?:\n\s*\n|#|$))/i,
  /los\s+angeles\s+fair\s+chance\s+initiative[\s\S]*?(?=(?:\n\s*\n|#|$))/i,
  /(?:privacy\s+policy|recruitment\s+privacy\s+notice)[\s\S]*?(?=(?:\n\s*\n|#|$))/i,
  /to\s+all\s+recruitment\s+agencies:?\s+we\s+do\s+not\s+accept\s+unsolicited\s+agency\s+resumes[\s\S]*?(?=(?:\n\s*\n|#|$))/i,
];

/**
 * Estimates token count using standard BPE heuristic (~3.8 characters per token for English prose/code).
 */
export function estimateTokens(text: string): number {
  if (!text || typeof text !== "string") return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;

  // Split on whitespace and punctuation bounds for accurate word count
  const charCount = trimmed.length;
  return Math.ceil(charCount / 3.8);
}

/**
 * Strips verbose legal, EEOC, and agency boilerplates from raw job descriptions.
 * Preserves all technical requirements, qualifications, company info, and compensation terms.
 */
export function stripJobBoilerplate(text: string): string {
  if (!text || typeof text !== "string") return "";

  let cleaned = text;

  for (const pattern of EEO_BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }

  // Collapse 3+ consecutive newlines into 2
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

/**
 * Truncates text safely at sentence or paragraph boundary if token estimation exceeds budget.
 */
export function truncateToTokenBudget(text: string, maxTokens: number): string {
  if (!text || maxTokens <= 0) return "";
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) return text;

  const maxChars = Math.floor(maxTokens * 3.8);
  const truncated = text.slice(0, maxChars);

  // Find last newline or period to avoid cutting mid-word
  const lastNewline = truncated.lastIndexOf("\n");
  const lastPeriod = truncated.lastIndexOf(".");

  const cutIndex = Math.max(lastNewline, lastPeriod);
  if (cutIndex > maxChars * 0.7) {
    return truncated.slice(0, cutIndex + 1).trim();
  }

  return truncated.trim() + "...";
}
