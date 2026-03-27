/**
 * Oura API fetch layer — build step.
 * Fetches daily_resilience, daily_readiness, workout, daily_activity, sleep
 * for 2025-10-28 to 2026-02-12, merges by date.
 *
 * Run: npm run fetch                    → data/daily.json (OURA_TOKEN / OURA_PAT)
 * Run: npm run fetch -- --user dale     → data/dale.json (DALE_TOKEN)
 * Run: npm run fetch:dale               → same as --user dale
 *
 * Partner OAuth app: DALE_CLIENT_ID + DALE_CLIENT_SECRET; token via npm run get-token -- --user dale.
 */

import "dotenv/config";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const BASE_URL = "https://api.ouraring.com/v2/usercollection";
const START_DATE = "2025-10-28";
const END_DATE = "2026-02-12";

const RESILIENCE_LEVEL_MAP = {
  limited: 1,
  adequate: 2,
  solid: 3,
  strong: 4,
  exceptional: 5,
};

/**
 * Validate token by calling personal_info (no date params).
 * Throws if token is invalid or expired.
 */
function getTokenFor(target) {
  if (target === "dale") {
    const token =
      process.env.DALE_TOKEN ||
      process.env.DALE_OURA_TOKEN ||
      process.env.DALE_OURA_PAT ||
      process.env.DALE_PAT;
    if (!token) {
      throw new Error(
        "DALE_TOKEN (or legacy DALE_OURA_TOKEN / PAT) not set. Run npm run get-token -- --user dale."
      );
    }
    return token;
  }
  const token = process.env.OURA_TOKEN || process.env.OURA_PAT;
  if (!token) {
    throw new Error("OURA_TOKEN or OURA_PAT not set. Run npm run get-token first.");
  }
  return token;
}

async function validateToken(token, label) {
  const res = await fetch(`${BASE_URL}/personal_info`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Oura API token invalid (${res.status}): ${res.statusText}\n${text}`);
  }

  const info = await res.json();
  console.log(`Token valid (${label}). Account:`, info.email ?? info.id ?? "(see personal_info response)");
}

/**
 * Fetch all pages for an endpoint using next_token pagination.
 * @param {{ optionalScope?: boolean }} [options] If true, 401 (missing OAuth scope) returns [] instead of throwing.
 */
async function fetchPaginated(token, endpoint, params = {}, options = {}) {
  const { optionalScope = false } = options;
  const allData = [];
  let nextToken = null;

  do {
    const searchParams = new URLSearchParams({
      start_date: START_DATE,
      end_date: END_DATE,
      ...params,
    });
    if (nextToken) searchParams.set("next_token", nextToken);

    const url = `${BASE_URL}/${endpoint}?${searchParams}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const text = await res.text();
      if (optionalScope && res.status === 401) {
        console.warn(
          `Oura API ${endpoint}: token lacks scope (${res.status}). Continuing with no ${endpoint} data.`
        );
        return [];
      }
      throw new Error(`Oura API ${endpoint}: ${res.status} ${res.statusText}\n${text}`);
    }

    const json = await res.json();
    allData.push(...(json.data || []));
    nextToken = json.next_token || null;
  } while (nextToken);

  return allData;
}

/**
 * Fetch all five endpoints in parallel.
 */
async function fetchAll(token) {
  const [resilience, readiness, workouts, activity, sleep] = await Promise.all([
    fetchPaginated(token, "daily_resilience"),
    fetchPaginated(token, "daily_readiness"),
    fetchPaginated(token, "workout", {}, { optionalScope: true }),
    fetchPaginated(token, "daily_activity"),
    fetchPaginated(token, "sleep"),
  ]);

  return { resilience, readiness, workouts, activity, sleep };
}

/**
 * Build set of dates that have strength training workouts.
 * Activity type check is flexible; update after confirming from console.log.
 */
function buildStrengthDates(workouts) {
  const strengthDates = new Set();
  for (const w of workouts) {
    const activity = (w.activity || "").toLowerCase();
    if (
      activity.includes("strength") ||
      activity.includes("weight") ||
      activity.includes("resistance") ||
      activity === "weights" ||
      activity === "strength_training"
    ) {
      if (w.day) strengthDates.add(w.day);
    }
  }
  return strengthDates;
}

/**
 * Remap HRV balance from [1, 100] to [-1, 1] centered at 0.
 */
function remapHrvBalance(val) {
  if (val == null || typeof val !== "number") return null;
  return (val - 50) / 50;
}

/**
 * Convert sleep duration (seconds) to minutes. Sleep endpoint returns seconds.
 */
function toMinutes(val) {
  if (val == null || typeof val !== "number") return null;
  return Math.round(val / 60);
}

function addDuration(existing, incoming) {
  if (existing != null && incoming != null) return existing + incoming;
  return existing ?? incoming;
}

function parseMovement30Sec(raw) {
  if (Array.isArray(raw)) {
    const vals = raw.map(Number).filter((v) => Number.isFinite(v));
    return vals.length ? vals : null;
  }
  if (typeof raw === "string" && raw.length) {
    const vals = raw.split("").map(Number).filter((v) => Number.isFinite(v));
    return vals.length ? vals : null;
  }
  return null;
}

function defaultDay(day, strengthDates) {
  return {
    date: day,
    readinessScore: null,
    resilienceScore: null,
    resilienceLevel: null,
    hrvBalance: null,
    restfulness: null,
    steps: null,
    deepSleepMinutes: null,
    remSleepMinutes: null,
    sleepEfficiency: null,
    /** long_sleep: hypnogram for couples phase concordance (5 min per char) */
    sleepPhase5Min: null,
    /** long_sleep: movement signal, one value every 30 seconds (Oura 0-100). */
    movement30Sec: null,
    bedtimeStart: null,
    bedtimeEnd: null,
    isStrengthDay: strengthDates.has(day),
  };
}

/**
 * Merge all endpoints into a single array of day objects.
 */
function mergeDailyData({ resilience, readiness, workouts, activity, sleep }) {
  const strengthDates = buildStrengthDates(workouts);

  const byDate = new Map();

  for (const r of resilience) {
    const day = r.day;
    if (!day) continue;
    const level = r.level || "";
    const entry = defaultDay(day, strengthDates);
    entry.resilienceScore = RESILIENCE_LEVEL_MAP[level] ?? null;
    entry.resilienceLevel = level || null;
    byDate.set(day, entry);
  }

  for (const r of readiness) {
    const day = r.day;
    if (!day) continue;
    const existing = byDate.get(day) || defaultDay(day, strengthDates);
    existing.readinessScore = r.score ?? null;
    existing.hrvBalance = remapHrvBalance(r.contributors?.hrv_balance);
    const rf = r.contributors?.restfulness;
    if (rf != null && typeof rf === "number") existing.restfulness = rf;
    byDate.set(day, existing);
  }

  for (const a of activity) {
    const day = a.day;
    if (!day) continue;
    const existing = byDate.get(day) || defaultDay(day, strengthDates);
    existing.steps = a.steps ?? null;
    byDate.set(day, existing);
  }

  for (const s of sleep || []) {
    const day = s.day;
    if (!day) continue;
    const existing = byDate.get(day) || defaultDay(day, strengthDates);

    existing.deepSleepMinutes = addDuration(
      existing.deepSleepMinutes, toMinutes(s.deep_sleep_duration)
    );
    existing.remSleepMinutes = addDuration(
      existing.remSleepMinutes, toMinutes(s.rem_sleep_duration)
    );

    if (s.type === "long_sleep" && s.efficiency != null) {
      existing.sleepEfficiency = s.efficiency;
    }

    if (s.type === "long_sleep" && s.sleep_phase_5_min && typeof s.sleep_phase_5_min === "string") {
      const prev = (existing.sleepPhase5Min || "").length;
      const next = s.sleep_phase_5_min.length;
      if (next >= prev) {
        existing.sleepPhase5Min = s.sleep_phase_5_min;
        existing.movement30Sec = parseMovement30Sec(s.movement_30_sec);
        existing.bedtimeStart = s.bedtime_start ?? null;
        existing.bedtimeEnd = s.bedtime_end ?? null;
      }
    }

    byDate.set(day, existing);
  }

  const merged = Array.from(byDate.values()).sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  return merged;
}

function parseFetchArgs(argv) {
  let user = null;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--user" && argv[i + 1]) {
      user = argv[++i];
    }
  }
  if (user === "dale") return "dale";
  if (process.argv[2] === "dale") return "dale";
  return "me";
}

async function main() {
  const target = parseFetchArgs(process.argv);
  const token = getTokenFor(target);
  const label = target === "dale" ? "dale" : "you";
  await validateToken(token, label);

  const { resilience, readiness, workouts, activity, sleep } = await fetchAll(token);

  console.log("Raw response counts:", {
    resilience: resilience.length,
    readiness: readiness.length,
    workouts: workouts.length,
    activity: activity.length,
    sleep: sleep.length,
  });

  if (sleep.length > 0) {
    console.log("First sleep object (deep_sleep_duration in seconds):", JSON.stringify(sleep[0], null, 2));
  }

  if (resilience.length === 0 && readiness.length === 0 && activity.length === 0) {
    console.warn("\nAll endpoints returned 0. Running diagnostic: fetching daily_readiness without date params...");
    const diagRes = await fetch(`${BASE_URL}/daily_readiness`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const diagJson = await diagRes.json();
    const diagData = diagJson.data || [];
    console.warn(`Diagnostic (no date filter): daily_readiness returned ${diagData.length} items.`);
    if (diagData.length > 0) {
      console.warn("Date range may be wrong. First item day:", diagData[0]?.day);
    } else {
      console.warn("No data without date filter. Check: 1) OAuth app has daily+workout+stress scopes enabled, 2) Re-run npm run get-token, 3) Oura account has data in range.");
    }
  }

  if (workouts.length === 0) {
    console.warn("Warning: workout endpoint returned 0 items. Ensure your token has the 'workout' scope.");
  }

  console.log("First 3 workout objects (raw, before filtering):");
  console.log(JSON.stringify(workouts.slice(0, 3), null, 2));

  const merged = mergeDailyData({ resilience, readiness, workouts, activity, sleep });

  const fileName = target === "dale" ? "dale.json" : "daily.json";
  const outPath = join(dirname(fileURLToPath(import.meta.url)), fileName);
  writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf8");
  console.log(`Wrote ${merged.length} days to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
