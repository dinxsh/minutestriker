import { fetchServerSnapshot, handleApiError, sendJson } from "../../api/_txline.js";

export default async function handler(request, response) {
  try {
    const url = new URL(request.url, "http://localhost");
    const fixtureId = url.searchParams.get("fixtureId");
    const snapshot = await fetchServerSnapshot(fixtureId);
    sendJson(response, 200, { snapshot });
  } catch (error) {
    handleApiError(response, error);
  }
}
