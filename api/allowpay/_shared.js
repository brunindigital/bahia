const API_BASE = "https://allow-gi0i.onrender.com";

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function apiKey() {
  return process.env.ALLOWPAY_API_KEY;
}

async function allowpayFetch(path, options) {
  if (!apiKey()) throw new Error("ALLOWPAY_API_KEY não configurada na Vercel.");
  const response = await fetch(API_BASE + path, options);
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function validCPF(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

module.exports = { json, apiKey, allowpayFetch, onlyDigits, validCPF };
