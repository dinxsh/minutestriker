import { createBentoSdk, walletAuthProvider } from "@bento.fun/sdk";

const DEFAULT_BENTO_URL = "https://internal-server.bento.fun";

export function getBentoServerConfig() {
  const baseUrl = stripTrailingSlash(process.env.BENTO_URL || DEFAULT_BENTO_URL);
  const tournamentsBaseUrl = stripTrailingSlash(
    process.env.PARLAY_TOURNMENT_URL || process.env.PARLAY_TOURNAMENT_URL || "",
  );
  const apiKey = process.env.BENTO_BUILDER_API_KEY || process.env.BUILDER_API_KEY;

  return {
    baseUrl,
    tournamentsBaseUrl,
    apiKey,
    configured: hasValue(apiKey),
    missing: [!hasValue(apiKey) ? "BENTO_BUILDER_API_KEY or BUILDER_API_KEY" : null].filter(Boolean),
  };
}

export function bentoReadinessPayload() {
  const config = getBentoServerConfig();

  return {
    baseUrl: config.baseUrl,
    tournamentsBaseUrl: config.tournamentsBaseUrl || null,
    configured: config.configured,
    hasBuilderApiKey: hasValue(config.apiKey),
    missing: config.missing.map(displayMissingKey),
  };
}

export async function fetchBentoMarkets({ page = 1, limit = 20 } = {}) {
  const sdk = createPublicBentoSdk();
  const payload = await sdk.public.listDuels({ page: numberOr(page, 1), limit: numberOr(limit, 20) });
  return {
    raw: payload,
    markets: listFrom(payload?.data ?? payload?.markets ?? payload?.duels ?? payload).map(normalizeBentoMarket),
  };
}

export async function fetchBentoMarket(duelId) {
  if (!duelId) throw httpError(400, "duelId is required");

  const sdk = createPublicBentoSdk();
  const payload = await sdk.public.getDuelById({ duelId });
  return {
    raw: payload,
    market: normalizeBentoMarket(payload?.data ?? payload?.market ?? payload?.duel ?? payload),
  };
}

export async function loginBentoUser({ address, signature, timestamp, username, inviteCode }) {
  if (!address) throw httpError(400, "address is required");
  if (!signature) throw httpError(400, "signature is required");
  if (!timestamp) throw httpError(400, "timestamp is required");

  const sdk = createPublicBentoSdk();
  const login = await sdk.public.auth.eoaLogin({ address, signature, timestamp });
  const token = login?.token || login?.data?.token;
  const exists = login?.exists ?? login?.data?.exists;
  if (token || exists !== false) return login;

  const safeUsername = usernameFrom(username || address);
  const registerPayload = {
    address,
    signature,
    timestamp,
    ...(inviteCode || process.env.BENTO_INVITE_CODE ? { inviteCode: inviteCode || process.env.BENTO_INVITE_CODE } : {}),
  };

  try {
    return await sdk.public.auth.eoaRegister({ ...registerPayload, username: safeUsername });
  } catch (error) {
    if ((error.sdkError?.status || error.statusCode || error.status) !== 409) throw error;
    return sdk.public.auth.eoaRegister({
      ...registerPayload,
      username: usernameFrom(`${safeUsername}-${String(address).slice(2, 10)}`),
    });
  }
}

export async function createBentoExternalLink({ returnUrl, state }) {
  if (!returnUrl) throw httpError(400, "returnUrl is required");
  const sdk = createPublicBentoSdk();
  return sdk.public.externalLink.getLinkUrl({ returnUrl, state });
}

export async function exchangeBentoExternalLink({ code }) {
  if (!code) throw httpError(400, "code is required");
  const sdk = createPublicBentoSdk();
  return sdk.public.externalLink.exchange({ code });
}

export async function estimateBentoBet({ token, duelId, optionIndex, betAmountUsdc, slippageBps = 100 }) {
  if (!token) throw httpError(401, "Bento login is required");
  if (!duelId) throw httpError(400, "duelId is required");
  if (optionIndex === undefined || optionIndex === null) throw httpError(400, "optionIndex is required");
  if (!betAmountUsdc) throw httpError(400, "betAmountUsdc is required");

  const sdk = createUserBentoSdk(token);
  return sdk.user.bets.estimateBuy({
    duelId,
    optionIndex: Number(optionIndex),
    betAmountUsdc,
    slippageBps: Number(slippageBps),
  });
}

export async function placeBentoBet({ token, idempotencyKey, bet }) {
  if (!token) throw httpError(401, "Bento login is required");
  if (!bet?.duelId) throw httpError(400, "duelId is required");

  const sdk = createUserBentoSdk(token);
  if (bet.estimate) {
    return sdk.user.bets.placeBetFromEstimate(bet, idempotencyKey ? { idempotencyKey } : undefined);
  }
  return sdk.user.bets.placeBet(normalizePlaceBetNumbers(bet), idempotencyKey ? { idempotencyKey } : undefined);
}

export async function fetchBentoPortfolio({ token, account }) {
  if (!token && !account) throw httpError(401, "Bento login or account is required");

  const sdk = token ? createUserBentoSdk(token) : createPublicBentoSdk();
  const client = token ? sdk.user.portfolio : sdk.public.portfolio;
  const params = account ? { account } : {};
  const [details, positions] = await Promise.all([
    client.getAccountDetails(params).catch((error) => ({ error: error.message })),
    client.getPositions(params).catch((error) => ({ error: error.message })),
  ]);

  return { details, positions };
}

export function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

export async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};

  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, "Request body must be valid JSON", true);
  }
}

export function handleApiError(response, error) {
  const statusCode = error.statusCode || error.status || error.sdkError?.status || 500;
  const requestId = error.sdkError?.requestId;
  const message = error.sdkError?.message || error.message;
  sendJson(response, statusCode, {
    error: {
      message: error.expose || statusCode < 500 ? message : "Bento request failed",
      statusCode,
      ...(requestId ? { requestId } : {}),
    },
  });
}

function createPublicBentoSdk() {
  const config = requireConfiguredBento();
  return createBentoSdk({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    tournamentsBaseUrl: config.tournamentsBaseUrl || undefined,
    auth: walletAuthProvider(() => ({})),
  });
}

function createUserBentoSdk(token) {
  const config = requireConfiguredBento();
  return createBentoSdk({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    tournamentsBaseUrl: config.tournamentsBaseUrl || undefined,
    auth: walletAuthProvider(() => ({ Authorization: `Bearer ${token}` })),
  });
}

function requireConfiguredBento() {
  const config = getBentoServerConfig();
  if (!config.configured) {
    throw httpError(503, `Missing backend env: ${config.missing.join(", ")}`, true);
  }
  return config;
}

export function normalizeBentoMarket(item = {}) {
  const duelId = item.duelId ?? item.duel_id ?? item.marketId ?? item.id;
  const optionA = item.optionA ?? item.option_a ?? item.options?.[0] ?? item.outcomes?.[0] ?? {};
  const optionB = item.optionB ?? item.option_b ?? item.options?.[1] ?? item.outcomes?.[1] ?? {};
  const title =
    item.title ??
    item.question ??
    item.betString ??
    item.bet_string ??
    item.name ??
    item.description ??
    `${labelFrom(optionA, "YES")} vs ${labelFrom(optionB, "NO")}`;

  return {
    id: item.id ?? duelId,
    duelId: duelId ? String(duelId) : "",
    title,
    category: item.category ?? item.sport ?? item.type ?? "Prediction",
    status: item.status ?? item.state ?? item.marketStatus ?? "listed",
    optionA: labelFrom(optionA, "YES"),
    optionB: labelFrom(optionB, "NO"),
    liquidity: item.liquidity ?? item.pool ?? item.totalLiquidity ?? item.volume,
    endTime: item.endTime ?? item.endsAt ?? item.expiry ?? item.closeTime,
    raw: item,
  };
}

function labelFrom(value, fallback) {
  if (typeof value === "string") return value;
  return value?.label ?? value?.name ?? value?.title ?? value?.text ?? fallback;
}

function listFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.data)) return value.data;
  if (Array.isArray(value.items)) return value.items;
  if (Array.isArray(value.markets)) return value.markets;
  if (Array.isArray(value.duels)) return value.duels;
  return [value];
}

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasValue(value) {
  return Boolean(value && !String(value).startsWith("replace_with"));
}

function httpError(statusCode, message, expose = statusCode < 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.expose = expose;
  return error;
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/$/, "");
}

function displayMissingKey(key) {
  if (key.includes("BUILDER_API_KEY")) return "builder api key";
  return key.replace("BENTO_", "").toLowerCase().replaceAll("_", " ");
}

function usernameFrom(value) {
  const slug = String(value || "haramball")
    .toLowerCase()
    .replace(/[^a-z0-9_ -]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24)
    .replace(/^-|-$/g, "");
  return slug || "haramball-player";
}

function normalizePlaceBetNumbers(bet) {
  return {
    ...bet,
    optionIndex: Number(bet.optionIndex),
    sharesOut: numberFrom(bet.sharesOut),
    minSharesOut: numberFrom(bet.minSharesOut),
    quoteTimestamp: bet.quoteTimestamp === undefined ? undefined : Number(bet.quoteTimestamp),
    slippageBps: Number(bet.slippageBps ?? 100),
  };
}

function numberFrom(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}
