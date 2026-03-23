/**
 * Merge primary (data/daily.json) and partner (data/dale.json) by calendar day.
 * Computes sleep phase concordance (5-min hypnogram overlap) and carries Oura restfulness
 * (daily_readiness contributor, 0–100).
 *
 * Run: npm run merge-couples
 * Output: data/couples.json
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const MS_5MIN = 5 * 60 * 1000;

function readJsonArray(path, label) {
  let raw;
  try {
    raw = readFileSync(path, "utf8").trim();
  } catch (e) {
    console.error(`Cannot read ${label} at ${path}: ${e.message}`);
    process.exit(1);
  }
  if (!raw) {
    console.error(`${label} is empty. Run fetch first (e.g. npm run fetch or npm run fetch -- --user dale).`);
    process.exit(1);
  }
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) {
      console.error(`${label} must be a JSON array of day objects.`);
      process.exit(1);
    }
    return data;
  } catch (e) {
    console.error(`Invalid JSON in ${path}: ${e.message}`);
    process.exit(1);
  }
}

function phaseAt(phaseStr, bedtimeStart, tMs) {
  if (!phaseStr || !bedtimeStart) return null;
  const t0 = new Date(bedtimeStart).getTime();
  if (!Number.isFinite(t0)) return null;
  const idx = Math.floor((tMs - t0) / MS_5MIN);
  if (idx < 0 || idx >= phaseStr.length) return null;
  return phaseStr[idx];
}

/**
 * @returns {{ overall: number | null, segments: (number | null)[] }}
 */
function computePhaseConcordance(a, b) {
  const empty = { overall: null, segments: [null, null, null, null, null] };
  if (
    !a?.sleepPhase5Min ||
    !b?.sleepPhase5Min ||
    !a.bedtimeStart ||
    !b.bedtimeStart
  ) {
    return empty;
  }

  const startA = new Date(a.bedtimeStart).getTime();
  const endA = new Date(a.bedtimeEnd || a.bedtimeStart).getTime();
  const startB = new Date(b.bedtimeStart).getTime();
  const endB = new Date(b.bedtimeEnd || b.bedtimeStart).getTime();

  const overlapStart = Math.max(startA, startB);
  const overlapEnd = Math.min(endA, endB);
  if (!(overlapEnd > overlapStart + MS_5MIN)) {
    return empty;
  }

  let matches = 0;
  let total = 0;
  for (let t = overlapStart; t < overlapEnd; t += MS_5MIN) {
    const pa = phaseAt(a.sleepPhase5Min, a.bedtimeStart, t);
    const pb = phaseAt(b.sleepPhase5Min, b.bedtimeStart, t);
    if (pa != null && pb != null) {
      total++;
      if (pa === pb) matches++;
    }
  }
  const overall = total > 0 ? matches / total : null;

  const segDur = (overlapEnd - overlapStart) / 5;
  const segments = [];
  for (let s = 0; s < 5; s++) {
    const segStart = overlapStart + s * segDur;
    const segEnd = overlapStart + (s + 1) * segDur;
    let m = 0;
    let n = 0;
    for (let t = segStart; t < segEnd; t += MS_5MIN) {
      const pa = phaseAt(a.sleepPhase5Min, a.bedtimeStart, t);
      const pb = phaseAt(b.sleepPhase5Min, b.bedtimeStart, t);
      if (pa != null && pb != null) {
        n++;
        if (pa === pb) m++;
      }
    }
    segments.push(n > 0 ? m / n : null);
  }

  return { overall, segments };
}

function mean(nums) {
  const v = nums.filter((x) => typeof x === "number" && !Number.isNaN(x));
  if (v.length === 0) return null;
  return v.reduce((s, x) => s + x, 0) / v.length;
}

function main() {
  const dataDir = dirname(fileURLToPath(import.meta.url));
  const dailyPath = join(dataDir, "daily.json");
  const dalePath = join(dataDir, "dale.json");

  const you = readJsonArray(dailyPath, "daily.json");
  const dale = readJsonArray(dalePath, "dale.json");

  const byYou = new Map(you.map((row) => [row.date, row]));
  const byDale = new Map(dale.map((row) => [row.date, row]));

  const dates = [...byYou.keys()].filter((d) => byDale.has(d)).sort();

  const nights = [];
  for (const date of dates) {
    const y = byYou.get(date);
    const d = byDale.get(date);
    const { overall, segments } = computePhaseConcordance(y, d);

    const ry = y.restfulness;
    const rd = d.restfulness;
    let restfulnessCombined = null;
    if (typeof ry === "number" && typeof rd === "number") {
      restfulnessCombined = (ry + rd) / 2;
    } else if (typeof ry === "number") {
      restfulnessCombined = ry;
    } else if (typeof rd === "number") {
      restfulnessCombined = rd;
    }

    nights.push({
      date,
      phaseConcordance: overall,
      segmentConcordance: segments,
      restfulnessYou: ry ?? null,
      restfulnessDale: rd ?? null,
      restfulnessCombined,
      bedtimeStartYou: y.bedtimeStart ?? null,
      bedtimeStartDale: d.bedtimeStart ?? null,
    });
  }

  const concVals = nights.map((n) => n.phaseConcordance).filter((x) => x != null);
  const restVals = nights.map((n) => n.restfulnessCombined).filter((x) => x != null);

  const out = {
    meta: {
      generatedAt: new Date().toISOString(),
      primaryLabel: "you",
      partnerLabel: "dale",
      overlappingNights: nights.length,
      notes: [
        "phaseConcordance: fraction of 5-min buckets in clock overlap where sleep_phase_5_min matches (1=deep,2=light,3=REM,4=awake).",
        "restfulness*: from daily_readiness.contributors.restfulness (Oura 0–100 style). Re-fetch daily.json and dale.json after fetch.js adds these fields.",
      ],
    },
    aggregate: {
      meanPhaseConcordance: mean(concVals),
      meanRestfulnessCombined: mean(restVals),
    },
    nights,
  };

  const outPath = join(dataDir, "couples.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`Wrote ${nights.length} overlapping nights to ${outPath}`);
}

main();
