import { fetchScoreValidation, handleApiError, sendJson } from "../../api/_txline.js";

export default async function handler(request, response) {
  try {
    const url = new URL(request.url, "http://localhost");
    const payload = await fetchScoreValidation({
      fixtureId: url.searchParams.get("fixtureId"),
      seq: url.searchParams.get("seq"),
      statKey: url.searchParams.get("statKey"),
      statKeys: url.searchParams.get("statKeys"),
    });
    sendJson(response, 200, payload);
  } catch (error) {
    handleApiError(response, error);
  }
}
