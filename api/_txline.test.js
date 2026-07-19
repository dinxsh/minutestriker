import assert from "node:assert/strict";
import test from "node:test";
import { activationMessage, fetchScoreValidation, getServerConfig, readinessPayload, refreshGuestJwt } from "./_txline.js";

test("server config reports missing TxLINE secrets without exposing values", () => {
  const previousJwt = process.env.TXLINE_JWT;
  const previousToken = process.env.TXLINE_API_TOKEN;
  delete process.env.TXLINE_JWT;
  delete process.env.TXLINE_API_TOKEN;

  const readiness = readinessPayload();

  assert.equal(readiness.configured, false);
  assert.deepEqual(readiness.missing, ["jwt", "api token"]);
  assert.equal("guestJwt" in readiness, false);
  assert.equal("apiToken" in readiness, false);

  restoreEnv("TXLINE_JWT", previousJwt);
  restoreEnv("TXLINE_API_TOKEN", previousToken);
});

test("server config uses documented TxLINE hosts by network", () => {
  const previousNetwork = process.env.TXLINE_NETWORK;
  const previousOrigin = process.env.TXLINE_ORIGIN;
  delete process.env.TXLINE_ORIGIN;

  process.env.TXLINE_NETWORK = "mainnet";
  assert.equal(getServerConfig().apiBaseUrl, "https://txline.txodds.com/api");

  process.env.TXLINE_NETWORK = "devnet";
  const devnetConfig = getServerConfig();
  assert.equal(devnetConfig.apiBaseUrl, "https://txline-dev.txodds.com/api");
  assert.equal(devnetConfig.rpcUrl, "https://api.devnet.solana.com");
  assert.equal(devnetConfig.txlTokenMint, "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
  assert.equal(devnetConfig.programId, "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

  restoreEnv("TXLINE_NETWORK", previousNetwork);
  restoreEnv("TXLINE_ORIGIN", previousOrigin);
});

test("readiness exposes devnet metadata without exposing secrets", () => {
  const previousNetwork = process.env.TXLINE_NETWORK;
  process.env.TXLINE_NETWORK = "devnet";

  const readiness = readinessPayload();

  assert.equal(readiness.network, "devnet");
  assert.equal(readiness.apiBaseUrl, "https://txline-dev.txodds.com/api");
  assert.equal(readiness.rpcUrl, "https://api.devnet.solana.com");
  assert.equal(readiness.txlTokenMint, "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
  assert.equal("guestJwt" in readiness, false);
  assert.equal("apiToken" in readiness, false);

  restoreEnv("TXLINE_NETWORK", previousNetwork);
});

test("score validation requires fixture, sequence, and stat keys", async () => {
  await assert.rejects(
    () => fetchScoreValidation({ fixtureId: "18175981", seq: "991" }),
    /statKey or statKeys is required/,
  );

  await assert.rejects(
    () => fetchScoreValidation({ seq: "991", statKeys: "1,2" }),
    /fixtureId is required/,
  );
});

test("server builds TxLINE activation message from the local guest JWT", () => {
  const previousJwt = process.env.TXLINE_JWT;
  process.env.TXLINE_JWT = "guest.jwt";

  assert.equal(
    activationMessage({ txSig: "abc123", leagues: [] }),
    "abc123::guest.jwt",
  );

  restoreEnv("TXLINE_JWT", previousJwt);
});

test("refreshGuestJwt mints and caches a replacement guest token", async () => {
  const previousFetch = globalThis.fetch;
  const previousJwt = process.env.TXLINE_JWT;
  const previousVercel = process.env.VERCEL;
  process.env.VERCEL = "1";
  process.env.TXLINE_JWT = "old.jwt";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://txline.txodds.com/auth/guest/start");
    assert.equal(options.method, "POST");
    return Response.json({ token: "new.jwt" });
  };

  const token = await refreshGuestJwt();

  assert.equal(token, "new.jwt");
  assert.equal(process.env.TXLINE_JWT, "new.jwt");

  globalThis.fetch = previousFetch;
  restoreEnv("TXLINE_JWT", previousJwt);
  restoreEnv("VERCEL", previousVercel);
});

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
