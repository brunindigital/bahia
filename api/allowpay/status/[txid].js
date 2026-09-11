const { json, apiKey, allowpayFetch } = require("../_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Método não permitido." });
  const txid = req.query && req.query.txid;
  const route = req.query && req.query.route;
  if (!txid || !route) return json(res, 400, { error: "Transação incompleta." });
  if (!apiKey()) return json(res, 500, { error: "Pagamento indisponível: configure ALLOWPAY_API_KEY na Vercel." });

  try {
    const result = await allowpayFetch(`/api/v2/allowpay-seller/payment-status/${encodeURIComponent(txid)}?route=${encodeURIComponent(route)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey() })
    });
    return json(res, result.response.status, result.data);
  } catch (error) {
    return json(res, 502, { error: "Não foi possível consultar a AllowPay." });
  }
};
