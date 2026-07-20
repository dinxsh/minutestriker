import { fetchBentoMarket, handleApiError, sendJson } from "./_bento.js";

export default async function handler(request, response) {
  try {
    const url = new URL(request.url, "http://localhost");
    const payload = await fetchBentoMarket(url.searchParams.get("duelId"));
    sendJson(response, 200, payload);
  } catch (error) {
    handleApiError(response, error);
  }
}
