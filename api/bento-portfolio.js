import { fetchBentoPortfolio, handleApiError, readJsonBody, sendJson } from "./_bento.js";

export default async function handler(request, response) {
  try {
    const body = request.method === "POST" ? await readJsonBody(request) : {};
    const url = new URL(request.url, "http://localhost");
    const token = bearerToken(request) || body.token;
    const account = body.account || url.searchParams.get("account");
    const payload = await fetchBentoPortfolio({ token, account });
    sendJson(response, 200, payload);
  } catch (error) {
    handleApiError(response, error);
  }
}

function bearerToken(request) {
  const header = request.headers.authorization || request.headers.Authorization || "";
  return String(header).startsWith("Bearer ") ? String(header).slice(7) : "";
}
