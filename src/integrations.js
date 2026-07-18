const env = import.meta.env ?? {};
const TXLINE_NETWORK = env.VITE_TXLINE_NETWORK || "mainnet";
const TXLINE_ORIGIN = stripTrailingSlash(
  env.VITE_TXLINE_ORIGIN ||
    (TXLINE_NETWORK === "devnet" ? "https://txline-dev.txodds.com" : "https://txline.txodds.com"),
);
const TXLINE_JWT = env.VITE_TXLINE_JWT;
const TXLINE_API_TOKEN = env.VITE_TXLINE_API_TOKEN;
const TXLINE_FIXTURE_ID = env.VITE_TXLINE_FIXTURE_ID;
const TXLINE_SERVICE_LEVEL = env.VITE_TXLINE_SERVICE_LEVEL || "12";
const WORLDCUP_API_KEY = env.VITE_WORLDCUP_API_KEY;

export const txLineNetworkConfig = {
  network: TXLINE_NETWORK,
  apiOrigin: TXLINE_ORIGIN,
  apiBaseUrl: `${TXLINE_ORIGIN}/api`,
  guestAuthUrl: `${TXLINE_ORIGIN}/auth/guest/start`,
  serviceLevel: TXLINE_SERVICE_LEVEL,
  programId:
    TXLINE_NETWORK === "devnet"
      ? "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
      : "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA",
  txlTokenMint:
    TXLINE_NETWORK === "devnet"
      ? "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"
      : "Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL",
};

const demoEvents = [
  { type: "shot", label: "shot attempt registered", minute: 64, second: 8 },
  { type: "free_kick", label: "free kick awarded", minute: 64, second: 17 },
  { type: "duel", label: "duel won", minute: 64, second: 24 },
  { type: "corner", label: "corner pressure rising", minute: 64, second: 39 },
  { type: "yellow_card", label: "yellow card check", minute: 64, second: 51 },
];

export const initialMatchSnapshot = {
  source: "Demo Engine",
  connected: false,
  fixtureId: TXLINE_FIXTURE_ID || "demo-fixture",
  homeName: "USA",
  awayName: "BRA",
  homeScore: 1,
  awayScore: 1,
  minute: 64,
  status: "IN PLAY",
  homePossession: 51,
  awayShots: 7,
  attacks: 23,
  duels: 41,
  corners: 5,
  cards: 2,
  events: demoEvents,
  latestEvent: "simulated TxLINE-style event stream",
  sequence: 1001,
  raw: null,
  lastUpdated: new Date().toISOString(),
};

export function txLineConfigured() {
  return Boolean(
    TXLINE_JWT &&
      TXLINE_API_TOKEN &&
      !TXLINE_JWT.startsWith("replace_with") &&
      !TXLINE_API_TOKEN.startsWith("replace_with"),
  );
}

export async function fetchFixtures() {
  if (!txLineConfigured()) {
    return [snapshotToFixture(initialMatchSnapshot)];
  }

  const payload = await txLineFetch("/fixtures/snapshot");
  const fixtures = listFrom(payload).map(normalizeFixture).filter(Boolean);
  return fixtures.length ? fixtures : [];
}

export function buildActivationMessage({ txSig, jwt, leagues = [] }) {
  return `${txSig}:${leagues.join(",")}:${jwt}`;
}

export function getTxLineReadiness() {
  const hasGuestJwt = Boolean(TXLINE_JWT && !TXLINE_JWT.startsWith("replace_with"));
  const hasApiToken = Boolean(TXLINE_API_TOKEN && !TXLINE_API_TOKEN.startsWith("replace_with"));

  return {
    ...txLineNetworkConfig,
    configured: hasGuestJwt && hasApiToken,
    hasGuestJwt,
    hasApiToken,
    missing: [
      !hasGuestJwt ? "guest JWT" : null,
      !hasApiToken ? "activated API token" : null,
    ].filter(Boolean),
  };
}

export async function fetchLiveMatchSnapshot({ fixtureId, previous = initialMatchSnapshot } = {}) {
  const activeFixtureId = fixtureId || TXLINE_FIXTURE_ID || previous.fixtureId;

  if (txLineConfigured() && activeFixtureId && activeFixtureId !== "demo-fixture") {
    const [snapshotPayload, updatesPayload] = await Promise.all([
      txLineFetch(`/scores/snapshot/${encodeURIComponent(activeFixtureId)}`),
      txLineFetch(`/scores/updates/${encodeURIComponent(activeFixtureId)}`).catch(() => null),
    ]);

    return normalizeTxLine(snapshotPayload, updatesPayload, previous, activeFixtureId);
  }

  if (WORLDCUP_API_KEY && WORLDCUP_API_KEY !== "replace_with_worldcupapi_key") {
    const payload = await fetchJson(
      `https://api.worldcupapi.com/livescores?key=${encodeURIComponent(WORLDCUP_API_KEY)}`,
    );
    return normalizeWorldCupApi(payload, previous);
  }

  return simulateSnapshot(previous);
}

export function advanceDemoSnapshotMinute(previous = initialMatchSnapshot) {
  if (previous.connected) return previous;
  return {
    ...previous,
    minute: (previous.minute || initialMatchSnapshot.minute) + 1,
    events: (previous.events || []).map((event) => ({
      ...event,
      minute: (previous.minute || initialMatchSnapshot.minute) + 1,
    })),
  };
}

export function resolvePrediction({ question, pick, stake, snapshot, targetMinute }) {
  const events = eventsForMinute(snapshot.events, targetMinute);
  const answer = resolveQuestion(question, events, snapshot);
  const won = Boolean(pick) && pick === answer;
  const payout = won ? stake * 1.86 : 0;

  return {
    answer,
    won,
    payout,
    matchedEvents: events.filter((event) => question.match(event, snapshot)),
    receipt: {
      fixtureId: snapshot.fixtureId,
      lockedFixtureId: snapshot.fixtureId,
      source: snapshot.source,
      connected: snapshot.connected,
      targetMinute,
      rule: question.rule,
      answer,
      sequence: snapshot.sequence || "n/a",
      lockedSequence: snapshot.sequence || "n/a",
      checkedAt: new Date().toISOString(),
      eventCount: events.length,
    },
  };
}

function txLineFetch(path) {
  return fetchJson(`${txLineNetworkConfig.apiBaseUrl}${pathWithServiceLevel(path)}`, null, {
    Authorization: `Bearer ${TXLINE_JWT}`,
    "X-Api-Token": TXLINE_API_TOKEN,
    "X-Service-Level": TXLINE_SERVICE_LEVEL,
  });
}

export function buildTxLineDataRequest(path) {
  return {
    url: `${txLineNetworkConfig.apiBaseUrl}${pathWithServiceLevel(path)}`,
    headers: {
      Authorization: `Bearer ${TXLINE_JWT}`,
      "X-Api-Token": TXLINE_API_TOKEN,
      "X-Service-Level": TXLINE_SERVICE_LEVEL,
    },
  };
}

function pathWithServiceLevel(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}serviceLevel=${encodeURIComponent(TXLINE_SERVICE_LEVEL)}`;
}

async function fetchJson(url, apiKey, extraHeaders = {}) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...extraHeaders,
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Live feed returned ${response.status}`);
  }

  return response.json();
}

export function normalizeTxLine(snapshotPayload, updatesPayload, previous = initialMatchSnapshot, fixtureId = previous.fixtureId) {
  const match = firstMatch(snapshotPayload);
  const updateItems = listFrom(updatesPayload);
  const events = [...extractEvents(match), ...updateItems.flatMap(extractEvents)];
  const home = match?.home ?? match?.homeTeam ?? match?.teams?.home ?? {};
  const away = match?.away ?? match?.awayTeam ?? match?.teams?.away ?? {};
  const score = match?.score ?? match?.scores ?? {};
  const stats = match?.stats ?? match?.statistics ?? match?.Stats ?? {};
  const latestEvent = events.at(-1);

  return {
    source: "TxLINE Live",
    connected: true,
    fixtureId,
    homeName: home.name ?? home.abbreviation ?? match?.home_name ?? match?.HomeTeam ?? previous.homeName,
    awayName: away.name ?? away.abbreviation ?? match?.away_name ?? match?.AwayTeam ?? previous.awayName,
    homeScore: numberFrom(score.home ?? home.score ?? match?.home_score ?? match?.HomeScore, previous.homeScore),
    awayScore: numberFrom(score.away ?? away.score ?? match?.away_score ?? match?.AwayScore, previous.awayScore),
    minute: numberFrom(match?.minute ?? match?.match_minute ?? match?.time ?? latestEvent?.minute, previous.minute),
    status: match?.status ?? match?.matchStatus ?? match?.Status ?? previous.status,
    homePossession: numberFrom(stats.homePossession ?? stats.possession_home ?? statValue(stats, "possession_home"), previous.homePossession),
    awayShots: numberFrom(stats.awayShots ?? stats.shots_away ?? statValue(stats, "shots_away"), previous.awayShots),
    attacks: numberFrom(stats.attacks ?? stats.dangerousAttacks ?? statValue(stats, "attacks"), previous.attacks),
    duels: numberFrom(stats.duels ?? stats.tackles ?? statValue(stats, "duels"), previous.duels),
    corners: numberFrom(stats.corners ?? stats.totalCorners ?? statValue(stats, "corners"), previous.corners),
    cards: numberFrom(stats.cards ?? stats.yellowCards ?? statValue(stats, "cards"), previous.cards),
    events,
    latestEvent: eventLabel(latestEvent) ?? previous.latestEvent,
    sequence: latestEvent?.sequence ?? latestEvent?.Sequence ?? match?.sequence ?? match?.Sequence ?? previous.sequence,
    raw: { snapshot: snapshotPayload, updates: updatesPayload },
    lastUpdated: new Date().toISOString(),
  };
}

function normalizeWorldCupApi(payload, previous) {
  const match = Array.isArray(payload) ? payload[0] : payload?.data?.[0] ?? payload;
  if (!match) return simulateSnapshot(previous);

  return {
    ...previous,
    source: "WorldCup API Live",
    connected: true,
    homeName: match.home?.name ?? previous.homeName,
    awayName: match.away?.name ?? previous.awayName,
    homeScore: numberFrom(match.home_score ?? match.home?.score, previous.homeScore),
    awayScore: numberFrom(match.away_score ?? match.away?.score, previous.awayScore),
    minute: numberFrom(match.time, previous.minute),
    status: match.status ?? previous.status,
    latestEvent: match.last_changed ? `score feed changed ${match.last_changed}` : previous.latestEvent,
    lastUpdated: new Date().toISOString(),
  };
}

function simulateSnapshot(previous) {
  const tick = new Date();
  const nextEvent = demoEvents[Math.floor(Math.random() * demoEvents.length)];
  const minute = previous.minute || 64;
  const event = {
    ...nextEvent,
    minute,
    second: new Date().getSeconds(),
    sequence: (previous.sequence || 1000) + 1,
  };

  return {
    ...previous,
    source: "Demo Engine",
    connected: false,
    homePossession: clamp(previous.homePossession + (Math.random() > 0.5 ? 1 : -1), 35, 65),
    awayShots: previous.awayShots + (event.type === "shot" ? 1 : 0),
    attacks: previous.attacks + (Math.random() > 0.45 ? 1 : 0),
    duels: previous.duels + (event.type === "duel" ? 1 : 0),
    corners: previous.corners + (event.type === "corner" ? 1 : 0),
    cards: previous.cards + (event.type.includes("card") ? 1 : 0),
    events: [...(previous.events || []).slice(-30), event],
    latestEvent: event.label,
    sequence: event.sequence,
    lastUpdated: tick.toISOString(),
  };
}

function resolveQuestion(question, events, snapshot) {
  if (question.statOnly) return question.match({}, snapshot) ? "YES" : "NO";
  return events.some((event) => question.match(event, snapshot)) ? "YES" : "NO";
}

function eventsForMinute(events = [], targetMinute) {
  return events.filter((event) => numberFrom(event.minute ?? event.Minute ?? event.matchMinute, -1) === targetMinute);
}

function extractEvents(item) {
  if (!item) return [];
  if (Array.isArray(item)) return item.flatMap(extractEvents);
  const eventLists = [item.events, item.eventLog, item.Actions, item.actions, item.updates, item.data?.events].filter(Boolean);
  if (!eventLists.length && (item.type || item.Type || item.action || item.Action)) return [normalizeEvent(item)];
  return eventLists.flatMap((events) => listFrom(events).map(normalizeEvent));
}

function normalizeEvent(event) {
  const data = event.Data ?? event.data ?? {};
  const rawType = event.type ?? event.Type ?? event.action ?? event.Action ?? data.type ?? data.Type ?? "";
  const type = String(rawType).toLowerCase();
  const minute = numberFrom(event.minute ?? event.Minute ?? event.matchMinute ?? event.MatchMinute ?? data.minute, 0);

  return {
    ...event,
    data,
    type,
    minute,
    second: numberFrom(event.second ?? event.Second ?? data.second, 0),
    team: event.team ?? event.Team ?? data.team,
    label: eventLabel(event),
    sequence: event.sequence ?? event.Sequence ?? event.seq ?? event.Seq,
  };
}

export function normalizeFixture(item) {
  const fixtureId = item.fixtureId ?? item.FixtureId ?? item.id ?? item.Id;
  if (!fixtureId) return null;
  const home = item.home ?? item.homeTeam ?? item.teams?.home ?? {};
  const away = item.away ?? item.awayTeam ?? item.teams?.away ?? {};

  return {
    fixtureId: String(fixtureId),
    label: `${home.name ?? item.home_name ?? "Home"} vs ${away.name ?? item.away_name ?? "Away"}`,
    status: item.status ?? item.Status ?? "scheduled",
  };
}

function snapshotToFixture(snapshot) {
  return {
    fixtureId: snapshot.fixtureId,
    label: `${snapshot.homeName} vs ${snapshot.awayName}`,
    status: snapshot.status,
  };
}

function firstMatch(payload) {
  return Array.isArray(payload) ? payload[0] : payload?.match ?? payload?.data?.[0] ?? payload?.data ?? payload;
}

function listFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.fixtures)) return value.fixtures;
  if (Array.isArray(value.matches)) return value.matches;
  return [value];
}

function statValue(stats, key) {
  if (!stats) return undefined;
  if (Array.isArray(stats)) {
    return stats.find((stat) => String(stat.key ?? stat.type ?? stat.Type).toLowerCase() === key)?.value;
  }
  return undefined;
}

function numberFrom(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function eventLabel(event) {
  if (!event) return null;
  if (typeof event === "string") return event;
  const data = event.Data ?? event.data ?? {};
  return (
    event.label ??
    event.name ??
    event.description ??
    event.action ??
    event.Action ??
    event.type ??
    event.Type ??
    data.Outcome ??
    data.FreeKickType ??
    "match event"
  );
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/$/, "");
}
