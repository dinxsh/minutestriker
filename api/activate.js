import { activateApiToken, handleApiError, readJsonBody, readinessPayload, sendJson } from "./_txline.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: { message: "Method not allowed", statusCode: 405 } });
    return;
  }

  try {
    const body = await readJsonBody(request);
    await activateApiToken(body);
    sendJson(response, 200, {
      activated: true,
      readiness: readinessPayload(),
    });
  } catch (error) {
    handleApiError(response, error);
  }
}
