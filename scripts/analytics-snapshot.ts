/**
 * One-shot analytics snapshot.
 *
 * Reads VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY from .env, pulls the
 * last 90 days of analytics_events plus push_subscriptions metadata, and prints
 * a human-readable summary. SELECT on both tables is publicly readable per RLS,
 * so the anon key is sufficient.
 *
 * Run: npx tsx scripts/analytics-snapshot.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envText = readFileSync(resolve(process.cwd(), ".env"), "utf8");
  const env: Record<string, string> = {};
  for (const line of envText.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const URL = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !KEY) throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env");

const supabase = createClient(URL, KEY);

const NINETY_DAYS_AGO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

interface AnalyticsRow {
  id: string;
  event_name: string;
  event_data: Record<string, unknown> | null;
  session_id: string | null;
  created_at: string;
}

interface PushRow {
  endpoint: string;
  created_at: string;
}

async function fetchAllAnalytics(): Promise<AnalyticsRow[]> {
  const PAGE = 1000;
  const all: AnalyticsRow[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("analytics_events")
      .select("id, event_name, event_data, session_id, created_at")
      .gte("created_at", NINETY_DAYS_AGO)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as AnalyticsRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function fetchPushSubscriptions(): Promise<PushRow[]> {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, created_at");
  if (error) throw error;
  return (data || []) as PushRow[];
}

function fmt(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function dur(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return `${m}m ${sec}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

async function main() {
  console.log(`\n=== Analytics snapshot — od ${fmt(NINETY_DAYS_AGO)} ===\n`);

  const events = await fetchAllAnalytics();
  console.log(`Celkem eventů: ${events.length}`);

  const sessionIds = new Set(events.map((e) => e.session_id).filter(Boolean) as string[]);
  console.log(`Unikátních session_id: ${sessionIds.size}`);
  if (events.length === 0) {
    console.log("\nŽádná data — končím.");
    return;
  }
  console.log(`První event: ${fmt(events[0].created_at)}`);
  console.log(`Poslední event: ${fmt(events[events.length - 1].created_at)}`);

  // 3. Distribuce event jmen
  console.log(`\n--- Distribuce event jmen (90 dní) ---`);
  const byEvent: Record<string, { n: number; sessions: Set<string> }> = {};
  for (const e of events) {
    if (!byEvent[e.event_name]) byEvent[e.event_name] = { n: 0, sessions: new Set() };
    byEvent[e.event_name].n++;
    if (e.session_id) byEvent[e.event_name].sessions.add(e.session_id);
  }
  const eventRows = Object.entries(byEvent)
    .map(([name, v]) => ({ name, n: v.n, sessions: v.sessions.size }))
    .sort((a, b) => b.n - a.n);
  for (const r of eventRows) {
    console.log(`  ${r.name.padEnd(22)} count=${String(r.n).padStart(4)}  unique_sessions=${r.sessions}`);
  }

  // 2. Session-by-session timeline (last 20)
  console.log(`\n--- Session timeline (posledních 20 session) ---`);
  const bySession: Record<string, AnalyticsRow[]> = {};
  for (const e of events) {
    if (!e.session_id) continue;
    (bySession[e.session_id] ||= []).push(e);
  }
  const sessions = Object.entries(bySession)
    .map(([sid, evs]) => {
      const sorted = evs.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
      return {
        sid,
        started: sorted[0].created_at,
        ended: sorted[sorted.length - 1].created_at,
        events: sorted.map((e) => e.event_name),
      };
    })
    .sort((a, b) => b.started.localeCompare(a.started))
    .slice(0, 20);
  for (const s of sessions) {
    const elapsedMs = new Date(s.ended).getTime() - new Date(s.started).getTime();
    const counts: Record<string, number> = {};
    for (const ev of s.events) counts[ev] = (counts[ev] || 0) + 1;
    const summary = Object.entries(counts).map(([k, v]) => v > 1 ? `${k}×${v}` : k).join(", ");
    console.log(`  ${fmt(s.started)}  dur=${dur(elapsedMs).padEnd(10)} sid=${s.sid.slice(0, 8)} [${summary}]`);
  }

  // 4. Voice recording trail
  console.log(`\n--- Voice recording trail ---`);
  const voiceEvents = events.filter((e) => e.event_name.startsWith("voice_"));
  if (voiceEvents.length === 0) {
    console.log("  (žádné voice_ eventy)");
  } else {
    // Group by session
    const voiceBySession: Record<string, AnalyticsRow[]> = {};
    for (const e of voiceEvents) {
      if (!e.session_id) continue;
      (voiceBySession[e.session_id] ||= []).push(e);
    }
    let pairedStartStop = 0;
    let lonelyStarts = 0;
    let multiStartSameSession = 0;
    for (const evs of Object.values(voiceBySession)) {
      const sorted = evs.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
      const starts = sorted.filter((e) => e.event_name === "voice_record_start").length;
      const stops = sorted.filter((e) => e.event_name === "voice_record_stop").length;
      if (starts > 1) multiStartSameSession++;
      pairedStartStop += Math.min(starts, stops);
      lonelyStarts += Math.max(0, starts - stops);
      console.log(`  sid=${sorted[0].session_id?.slice(0, 8)} starts=${starts} stops=${stops}  ${sorted.map((e) => fmt(e.created_at)).join(" → ")}`);
    }
    console.log(`  → souhrn: páry start+stop = ${pairedStartStop}, osamocené start = ${lonelyStarts}, session s víc starty = ${multiStartSameSession}`);
  }

  // 6. Theme volba (last toggle per session)
  console.log(`\n--- Theme volba (poslední toggle v session) ---`);
  const themeBySession: Record<string, string> = {};
  for (const e of events) {
    if (e.event_name !== "theme_toggle" || !e.session_id) continue;
    const to = (e.event_data as { to?: string } | null)?.to;
    if (to) themeBySession[e.session_id] = to;
  }
  const themeCounts = { light: 0, dark: 0, other: 0 };
  for (const t of Object.values(themeBySession)) {
    if (t === "light") themeCounts.light++;
    else if (t === "dark") themeCounts.dark++;
    else themeCounts.other++;
  }
  console.log(`  light: ${themeCounts.light}  dark: ${themeCounts.dark}  other: ${themeCounts.other}  (z ${Object.keys(themeBySession).length} session, kde někdo přepnul)`);
  console.log(`  pozn.: session bez theme_toggle = uživatel nechal default light`);

  // 7. Hodina dne (page_view)
  console.log(`\n--- Kdy lidé otvírají aplikaci (page_view, hodina v Praze) ---`);
  const hourCounts: Record<number, number> = {};
  for (const e of events) {
    if (e.event_name !== "page_view") continue;
    const d = new Date(e.created_at);
    // Convert to Prague time (UTC+1 or UTC+2). Use Intl.DateTimeFormat for DST-correct conversion.
    const hourPrague = parseInt(
      new Intl.DateTimeFormat("cs-CZ", { hour: "2-digit", hour12: false, timeZone: "Europe/Prague" }).format(d),
      10
    );
    hourCounts[hourPrague] = (hourCounts[hourPrague] || 0) + 1;
  }
  for (let h = 0; h < 24; h++) {
    const n = hourCounts[h] || 0;
    if (n > 0) console.log(`  ${String(h).padStart(2, "0")}:00  ${"█".repeat(n)} (${n})`);
  }

  // 8. Den v týdnu
  console.log(`\n--- Den v týdnu (page_view) ---`);
  const dowNames = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];
  const dowCounts: Record<number, number> = {};
  for (const e of events) {
    if (e.event_name !== "page_view") continue;
    const d = new Date(e.created_at);
    // Day of week in Prague
    const wd = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "Europe/Prague" }).format(d);
    const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
    dowCounts[idx] = (dowCounts[idx] || 0) + 1;
  }
  for (let i = 0; i < 7; i++) {
    const n = dowCounts[i] || 0;
    console.log(`  ${dowNames[i]}  ${"█".repeat(n)} (${n})`);
  }

  // 5. Push subscribers
  console.log(`\n--- Push subscribers ---`);
  const pushRows = await fetchPushSubscriptions();
  console.log(`  Total: ${pushRows.length}`);
  if (pushRows.length > 0) {
    const sorted = pushRows.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    console.log(`  Nejstarší subscribe: ${fmt(sorted[0].created_at)}`);
    console.log(`  Nejnovější subscribe: ${fmt(sorted[sorted.length - 1].created_at)}`);
    const last7d = pushRows.filter((r) => new Date(r.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    console.log(`  Nových za posledních 7 dní: ${last7d.length}`);
    // Endpoint host distribution
    const hosts: Record<string, number> = {};
    for (const r of pushRows) {
      try {
        const u = new URL(r.endpoint);
        hosts[u.hostname] = (hosts[u.hostname] || 0) + 1;
      } catch {
        hosts["(invalid)"] = (hosts["(invalid)"] || 0) + 1;
      }
    }
    for (const [h, n] of Object.entries(hosts).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${h}: ${n}`);
    }
  }

  console.log("\n=== konec snapshotu ===\n");
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
