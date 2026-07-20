import { fetchServerFixtures, handleApiError, sendJson } from "../../api/_txline.js";

export default async function handler(_request, response) {
  try {
    const fixtures = await fetchServerFixtures();
    sendJson(response, 200, { fixtures, source: "TxLINE Live" });
  } catch (error) {
    handleApiError(response, error);
  }
}
