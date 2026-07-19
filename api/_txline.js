import fs from "node:fs/promises";
import path from "node:path";
import { initialMatchSnapshot, normalizeFixture, normalizeTxLine } from "../src/integrations.js";

const DEFAULT_MAINNET_ORIGIN = "https://txline.txodds.com";
const DEFAULT_DEVNET_ORIGIN = "https://txline-dev.txodds.com";
const NETWORKS = {
  mainnet: {
    rpcUrl: "https://api.mainnet-beta.solana.com",
    programId: "9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA",
    txlTokenMint: "Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL",
    defaultOrigin: DEFAULT_MAINNET_ORIGIN,
  },
  devnet: {
    rpcUrl: "https://api.devnet.solana.com",
    programId: "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J",
    txlTokenMint: "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG",
    defaultOrigin: DEFAULT_DEVNET_ORIGIN,
  },
};

export function getServerConfig() {
  const network = process.env.TXLINE_NETWORK || "mainnet";
  const networkConfig = NETWORKS[network] || NETWORKS.mainnet;
  const origin = stripTrailingSlash(
    process.env.TXLINE_ORIGIN || networkConfig.defaultOrigin,
  );
  const guestJwt = process.env.TXLINE_JWT;
  const apiToken = process.env.TXLINE_API_TOKEN;
  const serviceLevel = process.env.TXLINE_SERVICE_LEVEL || "12";
  const fixtureId = process.env.TXLINE_FIXTURE_ID;

  return {
    network,
    origin,
    apiBaseUrl: `${origin}/api`,
    guestAuthUrl: `${origin}/auth/guest/start`,
    rpcUrl: process.env.ANCHOR_PROVIDER_URL || networkConfig.rpcUrl,
    programId: networkConfig.programId,
    txlTokenMint: process.env.TOKEN_MINT_ADDRESS || networkConfig.txlTokenMint,
    serviceLevel,
    fixtureId,
    hasGuestJwt: hasValue(guestJwt),
    hasApiToken: hasValue(apiToken),
    configured: hasValue(guestJwt) && hasValue(apiToken),
    missing: [
      !hasValue(guestJwt) ? "TXLINE_JWT" : null,
      !hasValue(apiToken) ? "TXLINE_API_TOKEN" : null,
    ].filter(Boolean),
    guestJwt,
    apiToken,
  };
}

export function readinessPayload() {
  const config = getServerConfig();

  return {
    network: config.network,
    apiOrigin: config.origin,
    apiBaseUrl: config.apiBaseUrl,
    guestAuthUrl: config.guestAuthUrl,
    rpcUrl: config.rpcUrl,
    programId: config.programId,
    txlTokenMint: config.txlTokenMint,
    serviceLevel: config.serviceLevel,
    configured: config.configured,
    hasGuestJwt: config.hasGuestJwt,
    hasApiToken: config.hasApiToken,
    missing: config.missing.map((key) => key.replace("TXLINE_", "").toLowerCase().replace("_", " ")),
  };
}

export async function fetchServerFixtures() {
  const config = requireConfiguredTxLine();
  const payload = await txLineFetch(config, "/fixtures/snapshot");
  return listFrom(payload).map(normalizeFixture).filter(Boolean);
}

export async function fetchServerSnapshot(fixtureId) {
  if (!fixtureId) {
    throw httpError(400, "fixtureId is required");
  }

  const config = requireConfiguredTxLine();
  const [snapshotPayload, updatesPayload] = await Promise.all([
    txLineFetch(config, `/scores/snapshot/${encodeURIComponent(fixtureId)}`),
    txLineFetch(config, `/scores/updates/${encodeURIComponent(fixtureId)}`).catch(() => null),
  ]);

  return normalizeTxLine(snapshotPayload, updatesPayload, initialMatchSnapshot, fixtureId);
}

export async function fetchScoreValidation({ fixtureId, seq, statKey, statKeys }) {
  if (!fixtureId) throw httpError(400, "fixtureId is required");
  if (!seq) throw httpError(400, "seq is required");
  if (!statKey && !statKeys) throw httpError(400, "statKey or statKeys is required");

  const config = requireConfiguredTxLine();
  const params = new URLSearchParams({ fixtureId, seq });
  if (statKeys) {
    params.set("statKeys", statKeys);
  } else {
    params.set("statKey", statKey);
  }

  return txLineFetch(config, `/scores/stat-validation?${params.toString()}`);
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

export function activationMessage({ txSig, leagues = [] }) {
  const config = getServerConfig();
  if (!config.hasGuestJwt) {
    throw httpError(503, "Missing backend env: TXLINE_JWT", true);
  }

  const safeTxSig = String(txSig || "").trim();
  if (!safeTxSig) {
    throw httpError(400, "txSig is required", true);
  }

  return `${safeTxSig}:${normaliseLeagues(leagues).join(",")}:${config.guestJwt}`;
}

export async function activateApiToken({ txSig, walletSignature, leagues = [] }) {
  const config = getServerConfig();
  if (!config.hasGuestJwt) {
    throw httpError(503, "Missing backend env: TXLINE_JWT", true);
  }

  if (!String(txSig || "").trim()) {
    throw httpError(400, "txSig is required", true);
  }

  if (!String(walletSignature || "").trim()) {
    throw httpError(400, "walletSignature is required", true);
  }

  const response = await fetch(`${config.apiBaseUrl}/token/activate`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.guestJwt}`,
    },
    body: JSON.stringify({
      txSig,
      walletSignature,
      leagues: normaliseLeagues(leagues),
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw httpError(
      response.status,
      payload?.message || payload?.error?.message || `TxLINE activation returned ${response.status}`,
      true,
    );
  }

  const token = payload?.token || payload?.data?.token || payload?.data || payload;
  if (!token || typeof token !== "string") {
    throw httpError(502, "TxLINE activation did not return an API token", true);
  }

  process.env.TXLINE_API_TOKEN = token;
  await persistLocalEnvValue("TXLINE_API_TOKEN", token);
  return token;
}

export async function refreshGuestJwt() {
  const config = getServerConfig();
  const response = await fetch(config.guestAuthUrl, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw httpError(response.status, `TxLINE guest auth returned ${response.status}`, true);
  }

  const token = payload?.token || payload?.jwt || payload?.accessToken;
  if (!token || typeof token !== "string") {
    throw httpError(502, "TxLINE guest auth did not return a JWT", true);
  }

  process.env.TXLINE_JWT = token;
  await persistLocalEnvValue("TXLINE_JWT", token);
  return token;
}

export async function persistLocalEnvValue(key, value) {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") return false;

  const envPath = path.join(process.cwd(), ".env.local");
  const existing = await fs.readFile(envPath, "utf8").catch(() => "");
  const nextLine = `${key}=${value}`;
  const lines = existing
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith(`${key}=`));

  lines.push(nextLine);
  await fs.writeFile(envPath, `${lines.join("\n")}\n`, "utf8");
  return true;
}

export function handleApiError(response, error) {
  const statusCode = error.statusCode || 500;
  sendJson(response, statusCode, {
    error: {
      message: error.expose ? error.message : "Backend feed request failed",
      statusCode,
    },
  });
}

function requireConfiguredTxLine() {
  const config = getServerConfig();
  if (!config.configured) {
    throw httpError(503, `Missing backend env: ${config.missing.join(", ")}`, true);
  }
  return config;
}

async function txLineFetch(config, path) {
  const url = `${config.apiBaseUrl}${pathWithServiceLevel(path, config.serviceLevel)}`;
  let response = await fetchTxLineUrl(url, config);

  if (response.status === 401 && config.hasApiToken) {
    await refreshGuestJwt();
    response = await fetchTxLineUrl(url, getServerConfig());
  }

  if (!response.ok) {
    const message =
      response.status === 401
        ? "TxLINE authorization expired; reconnect wallet and activate TxLINE again"
        : `TxLINE returned ${response.status}`;
    throw httpError(response.status, message, true);
  }

  return response.json();
}

function fetchTxLineUrl(url, config) {
  return fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.guestJwt}`,
      "X-Api-Token": config.apiToken,
      "X-Service-Level": config.serviceLevel,
    },
  });
}

function pathWithServiceLevel(path, serviceLevel) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}serviceLevel=${encodeURIComponent(serviceLevel)}`;
}

function hasValue(value) {
  return Boolean(value && !String(value).startsWith("replace_with"));
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

function normaliseLeagues(leagues) {
  if (Array.isArray(leagues)) return leagues.map(String).filter(Boolean);
  if (!leagues) return [];
  return String(leagues).split(",").map((league) => league.trim()).filter(Boolean);
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
