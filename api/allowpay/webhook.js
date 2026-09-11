const crypto = require("crypto");

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safeEqual(expected, received) {
  const a = Buffer.from(expected || "");
  const b = Buffer.from(received || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const rawBody = await readRawBody(req);
  const secret = process.env.ALLOWPAY_WEBHOOK_SECRET;
  const signature = req.headers["x-allowpay-signature"];
  if (secret) {
    const expected = "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!safeEqual(expected, signature)) return res.status(401).json({ error: "Assinatura inválida." });
  }

  let event;
  try { event = JSON.parse(rawBody.toString("utf8")); } catch (error) { return res.status(400).json({ error: "JSON inválido." }); }
  if (event.event !== "payment.approved" || event.status !== "approved" || !event.txid) return res.status(200).json({ received: true });

  // A confirmação definitiva continua sendo consultada pelo checkout. O event_id
  // fica disponível para persistência futura sem confiar em eventos repetidos.
  return res.status(200).json({ received: true, event_id: event.event_id, txid: event.txid });
};

module.exports.config = { api: { bodyParser: false } };
