import { bentoReadinessPayload, handleApiError, sendJson } from "./_bento.js";

export default async function handler(_request, response) {
  try {
    sendJson(response, 200, bentoReadinessPayload());
  } catch (error) {
    handleApiError(response, error);
  }
}
