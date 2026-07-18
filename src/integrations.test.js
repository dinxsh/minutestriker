import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActivationMessage,
  buildTxLineDataRequest,
  getTxLineReadiness,
  initialMatchSnapshot,
  normalizeFixture,
  normalizeTxLine,
  resolvePrediction,
  txLineNetworkConfig,
} from "./integrations.js";

const shotQuestion = {
  rule: "YES if shot appears in target minute",
  match: (event) => event.type?.includes("shot"),
};

const possessionQuestion = {
  rule: "YES if home possession >= 50",
  statOnly: true,
  match: (_event, snapshot) => snapshot.homePossession >= 50,
};

test("resolves YES when a matching event exists in the locked minute", () => {
  const result = resolvePrediction({
    question: shotQuestion,
    pick: "YES",
    stake: 2,
    targetMinute: 64,
    snapshot: {
      fixtureId: "fx-1",
      source: "test",
      connected: true,
      sequence: 10,
      events: [
        { type: "shot", minute: 64 },
        { type: "corner", minute: 65 },
      ],
    },
  });

  assert.equal(result.answer, "YES");
  assert.equal(result.won, true);
  assert.equal(result.payout, 3.72);
  assert.equal(result.receipt.targetMinute, 64);
});

test("ignores matching events from a different minute", () => {
  const result = resolvePrediction({
    question: shotQuestion,
    pick: "YES",
    stake: 1,
    targetMinute: 64,
    snapshot: {
      fixtureId: "fx-1",
      source: "test",
      connected: true,
      events: [{ type: "shot", minute: 65 }],
    },
  });

  assert.equal(result.answer, "NO");
  assert.equal(result.won, false);
});

test("resolves stat-only questions from snapshot state", () => {
  const result = resolvePrediction({
    question: possessionQuestion,
    pick: "YES",
    stake: 5,
    targetMinute: 64,
    snapshot: {
      fixtureId: "fx-1",
      source: "test",
      connected: true,
      homePossession: 52,
      events: [],
    },
  });

  assert.equal(result.answer, "YES");
  assert.equal(result.won, true);
});

test("builds TxLINE data requests under the documented API base", () => {
  const request = buildTxLineDataRequest("/scores/snapshot/fx-1");

  assert.equal(txLineNetworkConfig.apiBaseUrl, "https://txline.txodds.com/api");
  assert.equal(request.url, "https://txline.txodds.com/api/scores/snapshot/fx-1?serviceLevel=12");
  assert.equal(request.headers.Authorization, "Bearer undefined");
  assert.equal(request.headers["X-Api-Token"], undefined);
});

test("reports missing TxLINE credentials explicitly", () => {
  const readiness = getTxLineReadiness();

  assert.equal(readiness.configured, false);
  assert.deepEqual(readiness.missing, ["guest JWT", "activated API token"]);
});

test("builds the exact standard free-bundle activation message", () => {
  assert.equal(
    buildActivationMessage({ txSig: "abc123", jwt: "guest.jwt", leagues: [] }),
    "abc123::guest.jwt",
  );
});

test("normalizes fixture ids and nested team labels", () => {
  assert.deepEqual(
    normalizeFixture({
      FixtureId: 908,
      teams: {
        home: { name: "USA" },
        away: { name: "Brazil" },
      },
      Status: "inplay",
    }),
    {
      fixtureId: "908",
      label: "USA vs Brazil",
      status: "inplay",
    },
  );

  assert.equal(normalizeFixture({ teams: { home: { name: "A" }, away: { name: "B" } } }), null);
});

test("normalizes TxLINE snapshots with stats, score, status, and event updates", () => {
  const snapshot = normalizeTxLine(
    {
      data: {
        homeTeam: { name: "USA", score: 2 },
        awayTeam: { name: "Brazil", score: 1 },
        match_minute: 72,
        Status: "IN PLAY",
        stats: [
          { key: "possession_home", value: 55 },
          { key: "shots_away", value: 8 },
          { key: "attacks", value: 31 },
          { key: "duels", value: 46 },
          { key: "corners", value: 6 },
          { key: "cards", value: 3 },
        ],
        events: [{ Type: "Shot", Minute: 72, Second: 12, Sequence: 77 }],
      },
    },
    {
      items: [{ Action: "Corner", Minute: 72, Second: 40, seq: 78 }],
    },
    initialMatchSnapshot,
    "fixture-72",
  );

  assert.equal(snapshot.connected, true);
  assert.equal(snapshot.fixtureId, "fixture-72");
  assert.equal(snapshot.homeName, "USA");
  assert.equal(snapshot.awayName, "Brazil");
  assert.equal(snapshot.homeScore, 2);
  assert.equal(snapshot.awayScore, 1);
  assert.equal(snapshot.minute, 72);
  assert.equal(snapshot.status, "IN PLAY");
  assert.equal(snapshot.homePossession, 55);
  assert.equal(snapshot.awayShots, 8);
  assert.equal(snapshot.attacks, 31);
  assert.equal(snapshot.events.length, 2);
  assert.equal(snapshot.latestEvent, "Corner");
  assert.equal(snapshot.sequence, 78);
});

test("normalizes TxLINE snapshots with missing fields by preserving previous values", () => {
  const snapshot = normalizeTxLine({}, null, initialMatchSnapshot, "configured-fixture");

  assert.equal(snapshot.fixtureId, "configured-fixture");
  assert.equal(snapshot.homeName, initialMatchSnapshot.homeName);
  assert.equal(snapshot.awayName, initialMatchSnapshot.awayName);
  assert.equal(snapshot.homeScore, initialMatchSnapshot.homeScore);
  assert.equal(snapshot.minute, initialMatchSnapshot.minute);
  assert.equal(snapshot.events.length, 0);
});
