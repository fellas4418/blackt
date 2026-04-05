/**
 * One-off: rebuild wordData.js — middle 24/day, high 40/day, no word loss.
 * Run: node _redistribute_worddata.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const SRC = path.join(ROOT, "wordData.js");
const OUT = path.join(ROOT, "wordData.js");

const MIDDLE_PER_DAY = 24;
const HIGH_PER_DAY = 40;

function loadWordsData() {
  let raw = fs.readFileSync(SRC, "utf8");
  raw = raw.replace(/^const\s+wordsData\s*=\s*/, "module.exports = ");
  fs.writeFileSync(path.join(ROOT, "_temp_wd_load.js"), raw);
  const data = require(path.join(ROOT, "_temp_wd_load.js"));
  fs.unlinkSync(path.join(ROOT, "_temp_wd_load.js"));
  return data;
}

function collectStudyWords(levelData) {
  const weeks = Object.keys(levelData)
    .filter((k) => /^week\d+$/.test(k))
    .sort((a, b) => parseInt(a.replace("week", ""), 10) - parseInt(b.replace("week", ""), 10));
  const out = [];
  for (const wk of weeks) {
    const week = levelData[wk];
    for (const d of ["1", "2", "3", "4", "5"]) {
      const v = week[d];
      if (Array.isArray(v)) {
        for (const item of v) out.push(JSON.parse(JSON.stringify(item)));
      }
    }
  }
  return out;
}

function chunkStudyDays(words, perDay) {
  const days = [];
  let i = 0;
  while (i < words.length) {
    days.push(words.slice(i, i + perDay));
    i += perDay;
  }
  return days;
}

function buildReviewDay(weekWords) {
  const n = weekWords.length;
  if (n === 0) {
    return { test: [], review_parts: [[], []] };
  }
  const half = Math.floor(n / 2);
  const part0 = weekWords.slice(0, half);
  const part1 = weekWords.slice(half);
  const test = weekWords.map((w) => JSON.parse(JSON.stringify(w)));
  return {
    test,
    review_parts: [
      part0.map((w) => JSON.parse(JSON.stringify(w))),
      part1.map((w) => JSON.parse(JSON.stringify(w))),
    ],
  };
}

function buildWeekFromChunks(chunks, weekIndex, perDay) {
  const start = weekIndex * 5;
  const weekStudy = [];
  for (let d = 0; d < 5; d++) {
    const dayWords = chunks[start + d] || [];
    weekStudy.push(...dayWords);
  }
  const week = {};
  for (let d = 0; d < 5; d++) {
    const dayWords = chunks[start + d] || [];
    week[String(d + 1)] = dayWords.map((w) => JSON.parse(JSON.stringify(w)));
  }
  const rev = buildReviewDay(weekStudy);
  week["6"] = JSON.parse(JSON.stringify(rev));
  week["7"] = JSON.parse(JSON.stringify(rev));
  return week;
}

function rebuildLevel(levelData, perDay) {
  const collected = collectStudyWords(levelData);
  const chunks = chunkStudyDays(collected, perDay);
  const numWeeks = Math.ceil(chunks.length / 5) || 1;
  const out = {};
  for (let wi = 0; wi < numWeeks; wi++) {
    out["week" + (wi + 1)] = buildWeekFromChunks(chunks, wi, perDay);
  }
  return { words: collected, out, chunks };
}

function main() {
  const wordsData = loadWordsData();
  const mid = rebuildLevel(wordsData.middle, MIDDLE_PER_DAY);
  const hi = rebuildLevel(wordsData.high, HIGH_PER_DAY);

  const placedMid = mid.chunks.reduce((s, a) => s + a.length, 0);
  const placedHi = hi.chunks.reduce((s, a) => s + a.length, 0);
  if (placedMid !== mid.words.length) throw new Error("middle count mismatch");
  if (placedHi !== hi.words.length) throw new Error("high count mismatch");

  const result = {
    middle: mid.out,
    high: hi.out,
  };

  const serialized = "const wordsData = " + JSON.stringify(result, null, 2) + ";\n";
  fs.writeFileSync(OUT, serialized, "utf8");
  console.log(
    "OK middle words:",
    mid.words.length,
    "weeks:",
    Object.keys(mid.out).length,
    "| high words:",
    hi.words.length,
    "weeks:",
    Object.keys(hi.out).length
  );
}

main();
