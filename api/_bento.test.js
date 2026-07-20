import assert from "node:assert/strict";
import test from "node:test";
import { bentoReadinessPayload, getBentoServerConfig, normalizeBentoMarket } from "./_bento.js";

test("Bento readiness reports missing builder key without exposing secrets", () => {
  const previousKey = process.env.BENTO_BUILDER_API_KEY;
  const previousAlias = process.env.BUILDER_API_KEY;
  delete process.env.BENTO_BUILDER_API_KEY;
  delete process.env.BUILDER_API_KEY;

  const readiness = bentoReadinessPayload();

  assert.equal(readiness.configured, false);
  assert.deepEqual(readiness.missing, ["builder api key"]);
  assert.equal("apiKey" in readiness, false);

  restoreEnv("BENTO_BUILDER_API_KEY", previousKey);
  restoreEnv("BUILDER_API_KEY", previousAlias);
});

test("Bento server config uses documented hackathon hosts and env aliases", () => {
  const previousUrl = process.env.BENTO_URL;
  const previousKey = process.env.BENTO_BUILDER_API_KEY;
  const previousAlias = process.env.BUILDER_API_KEY;
  const previousTournaments = process.env.PARLAY_TOURNMENT_URL;
  delete process.env.BENTO_URL;
  delete process.env.BENTO_BUILDER_API_KEY;
  process.env.BUILDER_API_KEY = "bnt_test";
  process.env.PARLAY_TOURNMENT_URL = "https://bento-fun-tournaments-backend-3nku.onrender.com/";

  const config = getBentoServerConfig();

  assert.equal(config.baseUrl, "https://internal-server.bento.fun");
  assert.equal(config.tournamentsBaseUrl, "https://bento-fun-tournaments-backend-3nku.onrender.com");
  assert.equal(config.configured, true);
  assert.equal(config.apiKey, "bnt_test");

  restoreEnv("BENTO_URL", previousUrl);
  restoreEnv("BENTO_BUILDER_API_KEY", previousKey);
  restoreEnv("BUILDER_API_KEY", previousAlias);
  restoreEnv("PARLAY_TOURNMENT_URL", previousTournaments);
});

test("normalizes Bento market list rows around duelId and option labels", () => {
  assert.deepEqual(
    normalizeBentoMarket({
      id: "row-1",
      duelId: "duel-42",
      question: "Will Bento grow this week?",
      category: "Growth",
      options: [{ label: "YES" }, { label: "NO" }],
      totalLiquidity: "1000000000000000000",
    }),
    {
      id: "row-1",
      duelId: "duel-42",
      title: "Will Bento grow this week?",
      category: "Growth",
      status: "listed",
      optionA: "YES",
      optionB: "NO",
      liquidity: "1000000000000000000",
      endTime: undefined,
      raw: {
        id: "row-1",
        duelId: "duel-42",
        question: "Will Bento grow this week?",
        category: "Growth",
        options: [{ label: "YES" }, { label: "NO" }],
        totalLiquidity: "1000000000000000000",
      },
    },
  );
});

function restoreEnv(key, value) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
