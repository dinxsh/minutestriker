import { handleApiError, loginBentoUser, readJsonBody, sendJson } from "./_bento.js";

export default async function handler(request, response) {
  try {
    const body = await readJsonBody(request);
    const payload = await loginBentoUser(body);
    sendJson(response, 200, payload);
  } catch (error) {
    handleApiError(response, error);
  }
}
