const WEI_PER_TOKEN = 10n ** 18n;

export const initialBentoReadiness = {
  baseUrl: "https://internal-server.bento.fun",
  tournamentsBaseUrl: null,
  configured: false,
  hasBuilderApiKey: false,
  missing: ["builder api key"],
};

export async function fetchBentoReadiness() {
  try {
    return await fetchJson("/api/bento-readiness");
  } catch {
    return initialBentoReadiness;
  }
}

export async function fetchBentoMarkets({ page = 1, limit = 20 } = {}) {
  const payload = await fetchJson(`/api/bento-markets?page=${page}&limit=${limit}`);
  return payload.markets || [];
}

export async function fetchBentoMarket(duelId) {
  const payload = await fetchJson(`/api/bento-market?duelId=${encodeURIComponent(duelId)}`);
  return payload.market;
}

export async function loginBentoWallet({ address, signature, timestamp, username }) {
  return postJson("/api/bento-login", { address, signature, timestamp, username });
}

export async function createBentoWalletLink({ returnUrl, state }) {
  return postJson("/api/bento-link", { returnUrl, state });
}

export async function exchangeBentoWalletCode({ code }) {
  return postJson("/api/bento-exchange", { code });
}

export async function estimateBentoBet({ token, duelId, optionIndex, amountWei, slippageBps = 100 }) {
  return postJson(
    "/api/bento-estimate",
    { duelId, optionIndex, betAmountUsdc: amountWei, slippageBps },
    token,
  );
}

export async function placeBentoBet({ token, idempotencyKey, bet }) {
  return postJson("/api/bento-place-bet", { idempotencyKey, bet }, token);
}

export async function fetchBentoPortfolio({ token, account } = {}) {
  return postJson("/api/bento-portfolio", { account }, token);
}

export async function fetchLeaderboardUsers() {
  const payload = await fetchJson("/api/users");
  return payload.users || [];
}

export async function saveLeaderboardUser(user) {
  const payload = await postJson("/api/users", user);
  return payload.user;
}

export async function recordLeaderboardResult({ id, result = "win" }) {
  const response = await fetch("/api/users", {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id, result }),
  });
  return parseResponse(response);
}

export function humanToWei(value) {
  const [wholeRaw, fractionRaw = ""] = String(value || "0").split(".");
  const whole = BigInt(wholeRaw || "0");
  const fraction = BigInt((fractionRaw.replace(/\D/g, "").slice(0, 18).padEnd(18, "0")) || "0");
  return String(whole * WEI_PER_TOKEN + fraction);
}

export function weiToHuman(value) {
  try {
    const wei = BigInt(String(value || "0"));
    const whole = wei / WEI_PER_TOKEN;
    const fraction = String(wei % WEI_PER_TOKEN).padStart(18, "0").replace(/0+$/, "");
    return fraction ? `${whole}.${fraction.slice(0, 4)}` : String(whole);
  } catch {
    return "0";
  }
}

export function normalizeBentoLogin(payload = {}) {
  const token = payload.token || payload.accessToken || payload.jwt || payload.data?.token;
  const managedAccount =
    payload.accountAddress ||
    payload.managedAccount ||
    payload.account?.address ||
    payload.user?.accountAddress ||
    payload.data?.accountAddress ||
    payload.data?.user?.accountAddress;

  return {
    token,
    managedAccount,
    raw: payload,
  };
}

export function extractEstimate(payload = {}) {
  const estimate = payload.estimate || payload.data?.estimate || payload.data || payload;
  return {
    success: payload.success ?? estimate.success ?? true,
    quoteId: estimate.quote_id || estimate.quoteId,
    sharesOut: estimate.shares_out || estimate.sharesOut,
    minSharesOut: estimate.min_shares_out || estimate.minSharesOut,
    raw: payload,
  };
}

export function normalizeExternalLogin(payload = {}) {
  return {
    token: payload.token || payload.data?.token,
    address: payload.address || payload.data?.address,
    username: payload.username || payload.data?.username,
    managedAccount: payload.accountAddress || payload.managedAccount || payload.data?.accountAddress,
    raw: payload,
  };
}

export function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  return parseResponse(response);
}

async function postJson(url, body, token) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  return parseResponse(response);
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Bento returned ${response.status}`);
  }
  return payload;
}
