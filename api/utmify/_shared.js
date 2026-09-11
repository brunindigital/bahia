const UTMIFY_API_URL = process.env.UTMIFY_API_URL || "https://api.utmify.com.br/api-credentials/orders";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

function tracking(value) {
  const source = value || {};
  return {
    src: source.src || "",
    sck: source.sck || "",
    utm_source: source.utm_source || source.source || "",
    utm_campaign: source.utm_campaign || source.campaign || "",
    utm_medium: source.utm_medium || source.medium || "",
    utm_content: source.utm_content || "",
    utm_term: source.utm_term || ""
  };
}

function orderPayload(input, status) {
  const price = Number(input.price) || 0;
  const createdAt = input.createdAt || new Date().toISOString();
  return {
    orderId: String(input.orderId || input.txId || ""),
    platform: "AllowPay",
    paymentMethod: "pix",
    status,
    createdAt,
    approvedDate: status === "paid" ? (input.approvedDate || new Date().toISOString()) : null,
    refundedAt: null,
    customer: {
      name: String(input.name || "Cliente"),
      email: String(input.email || ""),
      phone: digits(input.phone),
      document: digits(input.cpf)
    },
    products: [{
      id: String(input.slug || input.orderId || "produto"),
      name: String(input.title || "Produto"),
      planId: null,
      planName: null,
      quantity: 1,
      priceInCents: Math.round(price * 100)
    }],
    trackingParameters: tracking(input.tracking),
    commission: {
      totalPriceInCents: Math.round(price * 100),
      gatewayFeeInCents: 0,
      userCommissionInCents: Math.round(price * 100)
    }
  };
}

async function sendOrder(input, status) {
  const token = process.env.UTMIFY_API_KEY;
  if (!token) {
    const error = new Error("UTMIFY_API_KEY não configurada na Vercel.");
    error.statusCode = 500;
    throw error;
  }
  const payload = orderPayload(input, status);
  if (!payload.orderId) {
    const error = new Error("orderId é obrigatório.");
    error.statusCode = 400;
    throw error;
  }
  const response = await fetch(UTMIFY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-token": token
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

module.exports = { json, sendOrder };
