const env = import.meta.env ?? {};
const TXLINE_NETWORK = env.VITE_TXLINE_NETWORK || "mainnet";
const TXLINE_ORIGIN = stripTrailingSlash(
  env.VITE_TXLINE_ORIGIN ||
    (TXLINE_NETWORK === "devnet" ? "https://txline-dev.txodds.com" : "https://txline.txodds.com"),
);
const TXLINE_FIXTURE_ID = env.VITE_TXLINE_FIXTURE_ID;
const TXLINE_SERVICE_LEVEL = env.VITE_TXLINE_SERVICE_LEVEL || "12";

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

export const initialMatchSnapshot = {
  source: "TxLINE required",
  connected: false,
  fixtureId: TXLINE_FIXTURE_ID || "",
  homeName: "",
  awayName: "",
  homeScore: 0,
  awayScore: 0,
  minute: 0,
  status: "WAITING",
  homePossession: 0,
  awayShots: 0,
  attacks: 0,
  duels: 0,
  corners: 0,
  cards: 0,
  events: [],
  latestEvent: "",
  sequence: "n/a",
  raw: null,
  lastUpdated: new Date().toISOString(),
};

export function txLineConfigured() {
  return false;
}

export async function fetchFixtures() {
  const payload = await fetchJson("/api/fixtures");
  return payload.fixtures?.length ? payload.fixtures : [];
}

export function buildActivationMessage({ txSig, jwt, leagues = [] }) {
  return `${txSig}:${leagues.join(",")}:${jwt}`;
}

export function getTxLineReadiness() {
  return {
    ...txLineNetworkConfig,
    configured: false,
    hasGuestJwt: false,
    hasApiToken: false,
    missing: ["guest JWT", "activated API token"],
  };
}

export async function fetchTxLineReadiness() {
  try {
    return await fetchJson("/api/readiness");
  } catch {
    return getTxLineReadiness();
  }
}

export async function fetchLiveMatchSnapshot({ fixtureId, previous = initialMatchSnapshot } = {}) {
  const activeFixtureId = fixtureId || TXLINE_FIXTURE_ID || previous.fixtureId;

  if (!activeFixtureId) {
    throw new Error("Select a TxLINE fixture before polling live match data");
  }

  const payload = await fetchJson(`/api/live?fixtureId=${encodeURIComponent(activeFixtureId)}`);
  return payload.snapshot;
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
  throw new Error(`Client TxLINE fetch is disabled; use /api${path}`);
}

export function buildTxLineDataRequest(path) {
  return {
    url: `${txLineNetworkConfig.apiBaseUrl}${pathWithServiceLevel(path)}`,
    headers: {
      Authorization: "Bearer undefined",
      "X-Api-Token": undefined,
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
    let message = `Live feed returned ${response.status}`;
    try {
      const payload = await response.json();
      message = payload?.error?.message || message;
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message);
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
    label: `${home.name ?? item.home_name ?? "Unlisted home"} vs ${away.name ?? item.away_name ?? "Unlisted away"}`,
    status: item.status ?? item.Status ?? "scheduled",
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

function numberFrom(value, defaultValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
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
