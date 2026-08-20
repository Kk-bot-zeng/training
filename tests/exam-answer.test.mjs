import assert from "node:assert/strict";
import test from "node:test";
import { isObjectiveAnswerCorrect, normalizeMultiAnswer } from "../src/lib/exam-answer.ts";

test("multi-choice accepts the supported answer formats", () => {
  const variants = ["ABC", "A,B,C", "A，B，C", "A、B、C", "A B C", "A|B|C", "A/B/C"];
  for (const variant of variants) {
    assert.equal(isObjectiveAnswerCorrect("multi", variant, "ABC"), true, variant);
  }
});

test("multi-choice ignores order and duplicate selections", () => {
  assert.equal(isObjectiveAnswerCorrect("multi", "C,B,A,A", "A,B,C"), true);
  assert.deepEqual(normalizeMultiAnswer("B|A|B"), ["A", "B"]);
});

test("multi-choice reads option prefixes without splitting ordinary text", () => {
  assert.equal(isObjectiveAnswerCorrect("multi", "A. xxx, C. zzz", "C,A"), true);
  assert.deepEqual(normalizeMultiAnswer("HDMI 2.1"), ["HDMI 2.1"]);
  assert.deepEqual(normalizeMultiAnswer("普通答案文本"), ["普通答案文本"]);
});

test("single-choice and judge normalization remain compatible", () => {
  assert.equal(isObjectiveAnswerCorrect("single", "a. 选项内容", "A"), true);
  assert.equal(isObjectiveAnswerCorrect("judge", "正确", "true"), true);
  assert.equal(isObjectiveAnswerCorrect("judge", "×", "false"), true);
});
