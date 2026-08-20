export type AnswerValue = string | string[] | null | undefined;

function asAnswerText(value: AnswerValue): string {
  if (Array.isArray(value)) return value.map((item) => asAnswerText(item)).join(",");
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value: AnswerValue): string {
  return asAnswerText(value)
    .normalize("NFKC")
    .replace(/\u00a0/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Normalize a single-choice answer while preserving ordinary answer text.
 * For example, "a. xxx" becomes "A", while "Apple" remains "APPLE".
 */
export function normalizeSingleAnswer(value: AnswerValue): string {
  const normalized = normalizeText(value);
  const optionLetter = normalized.match(/^([A-Z])(?:[.、:：\s]|$)/);
  return optionLetter ? optionLetter[1] : normalized;
}

/** Normalize the existing true/false aliases used by the exam module. */
export function normalizeJudgeAnswer(value: AnswerValue): string {
  const normalized = normalizeText(value).toLowerCase();
  if (["正确", "对", "是", "true", "yes", "√"].includes(normalized)) return "true";
  if (["错误", "错", "否", "false", "no", "×", "x"].includes(normalized)) return "false";
  return normalized;
}

function isCompactOptionSequence(value: string): boolean {
  // Compact answers such as ABC/BCD are common shorthand. Limiting this
  // form to A-F avoids splitting ordinary words such as HDMI into letters.
  return /^[A-F]{2,6}$/.test(value);
}

function prefixedOptionLetters(value: string): string[] {
  return Array.from(value.matchAll(/(?:^|\s)([A-Z])(?=[.)、:：])/g), (match) => match[1]);
}

function tokenizeMultiAnswer(value: AnswerValue): string[] {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  // Explicit separators are unambiguous, including the formats used by
  // imports and older records: A,B,C / A，B，C / A、B、C / A|B|C / A/B/C.
  if (/[,，、|/]/.test(normalized)) {
    return normalized.split(/[,，、|/]+/).map((token) => token.trim()).filter(Boolean);
  }

  if (isCompactOptionSequence(normalized)) return Array.from(normalized);

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((word) => /^[A-Z]$/.test(word))) return words;

  // Handle option text such as "A. xxx B. yyy" without splitting the text
  // itself into individual characters.
  const prefixed = prefixedOptionLetters(normalized);
  if (prefixed.length) return prefixed;

  return [normalized];
}

/**
 * Return a canonical, de-duplicated option/text set for multi-choice answers.
 * The sorted result makes selection order irrelevant.
 */
export function normalizeMultiAnswer(value: AnswerValue): string[] {
  const options = tokenizeMultiAnswer(value)
    .map((token) => normalizeSingleAnswer(token))
    .filter(Boolean);
  return Array.from(new Set(options)).sort();
}

export function isObjectiveAnswerCorrect(
  type: string,
  userAnswer: AnswerValue,
  correctAnswer: AnswerValue,
): boolean {
  if (type === "multi") {
    const actual = normalizeMultiAnswer(userAnswer);
    const expected = normalizeMultiAnswer(correctAnswer);
    return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
  }
  if (type === "judge") return normalizeJudgeAnswer(userAnswer) === normalizeJudgeAnswer(correctAnswer);
  return normalizeSingleAnswer(userAnswer) === normalizeSingleAnswer(correctAnswer);
}
