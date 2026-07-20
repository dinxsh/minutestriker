import { fetchBentoMarkets, handleApiError, sendJson } from "./_bento.js";

export default async function handler(request, response) {
  try {
    const url = new URL(request.url, "http://localhost");
    const page = url.searchParams.get("page") || 1;
    const limit = url.searchParams.get("limit") || 20;
    const payload = await fetchBentoMarkets({ page, limit });
    sendJson(response, 200, payload);
  } catch (error) {
    handleApiError(response, error);
  }
}
