const { json, sendOrder } = require("../utmify/_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const result = await sendOrder(body, "waiting_payment");
    return json(res, result.response.ok ? 200 : result.response.status, result.data);
  } catch (error) {
    return json(res, error.statusCode || 502, { error: error.message || "Falha ao enviar o evento para a UTMify." });
  }
};
