/**
 * Preservacao de UTM / parametros de rastreamento.
 * - Guarda os parametros da primeira visita (localStorage + cookie).
 * - Repassa os parametros em todos os links internos.
 * - getUrlWithUtm(url) usa a URL atual ou, se vazia, os parametros salvos.
 */
(function () {
  "use strict";

  var STORE_KEY = "arremata_tracking";
  var KEYS = [
    "src", "sck",
    "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term",
    "xcod", "fbclid", "gclid", "ttclid", "backactivated"
  ];

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }

  function readCookie() {
    var m = document.cookie.match(/(?:^|;\s*)arremata_tracking=([^;]+)/);
    if (!m) return {};
    try { return JSON.parse(decodeURIComponent(m[1])) || {}; } catch (e) { return {}; }
  }

  function writeStore(obj) {
    var raw = JSON.stringify(obj);
    try { localStorage.setItem(STORE_KEY, raw); } catch (e) { /* modo privado */ }
    try {
      document.cookie = "arremata_tracking=" + encodeURIComponent(raw) +
        ";path=/;max-age=" + (60 * 60 * 24 * 30) + ";SameSite=Lax";
    } catch (e) { /* ignore */ }
  }

  function capture() {
    var q = new URLSearchParams(window.location.search);
    var stored = readStore();
    if (!stored.utm_source && !stored.src) stored = readCookie();
    var out = {};
    var hasNew = false;
    KEYS.forEach(function (k) {
      var fromUrl = q.get(k);
      if (fromUrl) hasNew = true;
      out[k] = fromUrl || stored[k] || "";
    });
    // guarda tambem qualquer outro parametro desconhecido da URL
    q.forEach(function (v, k) { if (KEYS.indexOf(k) === -1 && v) out[k] = v; });
    Object.keys(stored).forEach(function (k) { if (!out[k]) out[k] = stored[k]; });
    // Fallback final: o script oficial da Utmify grava os parametros da primeira
    // visita em chaves proprias no localStorage (utm_source, utm_campaign, sck,
    // xcod...). Se o cliente voltar depois sem UTMs no link, recuperamos daqui
    // para a venda nao sair com "UTMs vazias".
    KEYS.forEach(function (k) {
      if (!out[k]) {
        try {
          var v = localStorage.getItem(k);
          if (v) out[k] = v;
        } catch (e) { /* modo privado */ }
      }
    });
    if (hasNew || Object.keys(stored).length === 0) writeStore(out);
    else writeStore(out);
    return out;
  }

  var tracking = capture();

  function trackingQuery() {
    // O script oficial da Utmify pode criar sck/xcod depois do carregamento.
    // Recapturamos antes de alterar links para não perder esses identificadores.
    tracking = capture();
    var p = new URLSearchParams();
    Object.keys(tracking).forEach(function (k) {
      if (tracking[k]) p.set(k, tracking[k]);
    });
    return p.toString();
  }

  function getUrlWithUtm(url) {
    if (typeof window === "undefined" || !url) return url;
    // Junta a URL atual com os dados recuperados do primeiro acesso. Antes,
    // bastava existir um único parâmetro na URL para sck/UTMs salvos serem
    // ignorados no próximo link.
    var merged = new URLSearchParams(window.location.search);
    var recovered = new URLSearchParams(trackingQuery());
    recovered.forEach(function (v, k) {
      if (!merged.get(k) && v) merged.set(k, v);
    });
    var params = merged.toString();
    if (!params) return url;
    if (/^(mailto:|tel:|javascript:|#)/i.test(url)) return url;
    var hash = "";
    var hashIdx = url.indexOf("#");
    if (hashIdx > -1) { hash = url.slice(hashIdx); url = url.slice(0, hashIdx); }
    var separator = url.indexOf("?") > -1 ? "&" : "?";
    return url + separator + params + hash;
  }

  function isInternal(href) {
    if (!href) return false;
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return false;
    if (href.charAt(0) === "#") return false;
    if (/^https?:\/\//i.test(href)) {
      try { return new URL(href).host === window.location.host; } catch (e) { return false; }
    }
    return true;
  }

  function patchLinks() {
    var q = trackingQuery();
    if (!q) return;
    var links = document.querySelectorAll("a[href]");
    Array.prototype.forEach.call(links, function (a) {
      if (a.getAttribute("data-utm-done") === "1") return;
      var href = a.getAttribute("href");
      if (!isInternal(href)) return;
      a.setAttribute("data-utm-done", "1");
      a.setAttribute("href", getUrlWithUtm(href));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", patchLinks);
  } else {
    patchLinks();
  }
  // conteudo carregado depois (cards, modais)
  setTimeout(patchLinks, 800);
  setTimeout(patchLinks, 2500);

  window.getUrlWithUtm = getUrlWithUtm;
  window.getTrackingParams = function () { return capture(); };
})();
