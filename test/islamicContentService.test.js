const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getEntryTextByLanguage,
  getRandomAzkar,
  getRandomHadith,
  normalizeContentLanguage,
  normalizeHadithGrade
} = require("../src/islamicContentService");

test("normalization falls back to supported defaults", () => {
  assert.equal(normalizeContentLanguage("ARABIC"), "arabic");
  assert.equal(normalizeContentLanguage("unknown"), "english");
  assert.equal(normalizeHadithGrade("hasan"), "hasan");
  assert.equal(normalizeHadithGrade("invalid-grade"), "sahih");
});

test("Arabic text is preferred when available", () => {
  const entry = { text: "English text", textArabic: "Arabic text" };
  assert.equal(getEntryTextByLanguage(entry, "arabic"), "Arabic text");
  assert.equal(getEntryTextByLanguage(entry, "english"), "English text");
});

test("random azkar returns stable result shape", () => {
  const result = getRandomAzkar({ recentIds: [], maxHistory: 10 });
  assert.ok(result.entry);
  assert.equal(typeof result.entry.id, "string");
  assert.equal(typeof result.entry.source, "string");
  assert.ok(Array.isArray(result.nextRecentIds));
  assert.ok(result.nextRecentIds.includes(result.entry.id));
});

test("hadith grade filter is respected", () => {
  const sahihOnly = getRandomHadith({ minGrade: "sahih" });
  assert.equal(sahihOnly.entry.grade, "sahih");

  const sahihOrHasan = getRandomHadith({ minGrade: "hasan" });
  assert.ok(["sahih", "hasan"].includes(sahihOrHasan.entry.grade));

  const anyGrade = getRandomHadith({ minGrade: "weak" });
  assert.ok(["sahih", "hasan", "weak"].includes(anyGrade.entry.grade));
});
