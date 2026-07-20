import { activationMessage, handleApiError, sendJson } from "../../api/_txline.js";

export default async function handler(request, response) {
  try {
    const url = new URL(request.url, "http://localhost");
    const txSig = url.searchParams.get("txSig");
    const leagues = url.searchParams.get("leagues") || "";
    sendJson(response, 200, { message: activationMessage({ txSig, leagues }) });
  } catch (error) {
    handleApiError(response, error);
  }
}
