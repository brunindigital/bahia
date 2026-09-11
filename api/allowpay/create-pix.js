const { json, apiKey, allowpayFetch, onlyDigits, validCPF } = require("./_shared");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  if (!apiKey()) return json(res, 500, { error: "Pagamento indisponível: configure ALLOWPAY_API_KEY na Vercel." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const customer = body.customer || {};
  const amount = Number(body.amount);
  const cellphone = onlyDigits(customer.cellphone);
  const taxId = onlyDigits(customer.taxId);

  if (!Number.isInteger(amount) || amount <= 0) return json(res, 400, { error: "Valor do pagamento inválido." });
  if (!customer.name || !customer.email || !cellphone) return json(res, 400, { error: "Informe nome, e-mail e celular." });
  if (cellphone.length !== 10 && cellphone.length !== 11) return json(res, 400, { error: "Informe um celular com DDD." });
  if (!validCPF(taxId)) return json(res, 400, { error: "Informe um CPF válido." });

  const forwardedProto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const webhookUrl = host ? `${forwardedProto}://${host}/api/allowpay/webhook` : undefined;
  const payload = {
    api_key: apiKey(),
    amount,
    description: String(body.description || "Compra Arremata+").slice(0, 200),
    customer: {
      name: String(customer.name).trim(),
      email: String(customer.email).trim(),
      cellphone,
      taxId
    }
  };
  if (webhookUrl) {
    payload.webhook_url = webhookUrl;
    if (process.env.ALLOWPAY_WEBHOOK_SECRET) payload.webhook_secret = process.env.ALLOWPAY_WEBHOOK_SECRET;
  }

  try {
    const result = await allowpayFetch("/api/v2/allowpay-seller/create-pix", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return json(res, result.response.status, result.data);
  } catch (error) {
    return json(res, 502, { error: "Não foi possível conectar à AllowPay." });
  }
};
