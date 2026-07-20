import { handleApiError, placeBentoBet, readJsonBody, sendJson } from "./_bento.js";

export default async function handler(request, response) {
  try {
    const body = await readJsonBody(request);
    const token = bearerToken(request) || body.token;
    const payload = await placeBentoBet({ ...body, token });
    sendJson(response, 200, payload);
  } catch (error) {
    handleApiError(response, error);
  }
}

function bearerToken(request) {
  const header = request.headers.authorization || request.headers.Authorization || "";
  return String(header).startsWith("Bearer ") ? String(header).slice(7) : "";
}
