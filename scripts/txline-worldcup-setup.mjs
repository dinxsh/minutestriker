import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }),
);

const network = args.get("network") || "mainnet";
const serviceLevel = args.get("service-level") || (network === "mainnet" ? "12" : "1");
const origin =
  args.get("origin") ||
  (network === "devnet" ? "https://txline-dev.txodds.com" : "https://txline.txodds.com");
const envPath = resolve(process.cwd(), ".env.local");
const env = readEnv(envPath);

env.TXLINE_NETWORK = network;
env.TXLINE_ORIGIN = stripTrailingSlash(origin);
env.TXLINE_SERVICE_LEVEL = serviceLevel;

if (args.get("fixture-id")) {
  env.TXLINE_FIXTURE_ID = args.get("fixture-id");
}

if (args.get("jwt")) {
  env.TXLINE_JWT = args.get("jwt");
} else if (!hasValue(env.TXLINE_JWT) && args.get("skip-jwt") !== "true") {
  const jwt = await fetchGuestJwt(env.TXLINE_ORIGIN);
  env.TXLINE_JWT = jwt;
}

if (args.get("api-token")) {
  env.TXLINE_API_TOKEN = args.get("api-token");
} else if (!env.TXLINE_API_TOKEN) {
  env.TXLINE_API_TOKEN = "replace_with_activated_api_token";
}

if (network === "devnet") {
  env.ANCHOR_PROVIDER_URL = env.ANCHOR_PROVIDER_URL || "https://api.devnet.solana.com";
  env.TOKEN_MINT_ADDRESS =
    env.TOKEN_MINT_ADDRESS || "4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG";
}

writeEnv(envPath, env);

const jwtStatus = hasValue(env.TXLINE_JWT) ? "present" : "missing";
const tokenStatus = hasValue(env.TXLINE_API_TOKEN) ? "present" : "missing";

console.log(`Wrote ${envPath}`);
console.log(`Network: ${env.TXLINE_NETWORK}`);
console.log(`Origin: ${env.TXLINE_ORIGIN}`);
console.log(`Service level: ${env.TXLINE_SERVICE_LEVEL}`);
console.log(`Guest JWT: ${jwtStatus}`);
console.log(`API token: ${tokenStatus}`);

if (!hasValue(env.TXLINE_API_TOKEN)) {
  console.log("");
  console.log("Next TxLINE activation steps:");
  console.log("1. Submit the TxLINE on-chain subscribe transaction for this network/service level.");
  console.log("2. Sign the exact activation message: txSig::TXLINE_JWT");
  console.log("3. POST to /api/token/activate with Authorization: Bearer TXLINE_JWT.");
  console.log("4. Re-run this script with --api-token=<activated token> or edit .env.local.");
}

function readEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key, rest.join("=")];
      }),
  );
}

function writeEnv(path, values) {
  const order = [
    "TXLINE_NETWORK",
    "TXLINE_ORIGIN",
    "TXLINE_JWT",
    "TXLINE_API_TOKEN",
    "TXLINE_SERVICE_LEVEL",
    "TXLINE_FIXTURE_ID",
    "ANCHOR_PROVIDER_URL",
    "ANCHOR_WALLET",
    "TOKEN_MINT_ADDRESS",
  ];
  const keys = [...order, ...Object.keys(values).filter((key) => !order.includes(key))];
  const lines = [
    "# Local TxLINE configuration. Do not commit this file.",
    ...keys
      .filter((key) => values[key] !== undefined && values[key] !== "")
      .map((key) => `${key}=${values[key]}`),
    "",
  ];
  writeFileSync(path, lines.join("\n"));
}

async function fetchGuestJwt(origin) {
  const response = await fetch(`${stripTrailingSlash(origin)}/auth/guest/start`, {
    method: "POST",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Guest auth failed with ${response.status}`);
  }

  const payload = await response.json();
  const token = payload.token || payload.jwt || payload.accessToken;
  if (!token) {
    throw new Error("Guest auth response did not include a token");
  }
  return token;
}

function hasValue(value) {
  return Boolean(value && !String(value).startsWith("replace_with"));
}

function stripTrailingSlash(value) {
  return String(value || "").replace(/\/$/, "");
}
