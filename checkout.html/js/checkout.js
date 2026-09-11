(function () {
  "use strict";

  // Dispara o evento de "Initiate Checkout" (IC) do pixel da Utmify.
  // O pixel escuta cliques em botões cujo texto contém palavras como "comprar",
  // então mantemos um botão invisível e clicamos nele quando o Pix é gerado.
  var icFired = false;
  var icBtn = null;
  function ensureIcButton() {
    if (icBtn) return icBtn;
    icBtn = document.createElement("button");
    icBtn.type = "button";
    icBtn.textContent = "Comprar";
    icBtn.setAttribute("aria-hidden", "true");
    icBtn.tabIndex = -1;
    icBtn.style.cssText = "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none";
    (document.body || document.documentElement).appendChild(icBtn);
    return icBtn;
  }
  function fireUtmifyIC() {
    if (icFired) return;
    icFired = true;
    try { ensureIcButton().click(); } catch (e) { /* pixel indisponível */ }
  }

  // Facebook / Meta Pixel — InitiateCheckout (quando o Pix é gerado)
  function fireFacebookIC(value, contentName, contentId) {
    try {
      if (typeof fbq === "function") {
        fbq("track", "InitiateCheckout", {
          value: Number(value) || 0,
          currency: "BRL",
          content_name: contentName || "Item arrematado",
          content_ids: contentId ? [String(contentId)] : undefined,
          content_type: "product",
          num_items: 1
        });
      }
    } catch (e) { /* pixel indisponível */ }
  }

  // Facebook / Meta Pixel — Purchase (quando o pagamento é confirmado)
  function fireFacebookPurchase(value, contentName, contentId, orderId) {
    try {
      if (typeof fbq === "function") {
        fbq("track", "Purchase", {
          value: Number(value) || 0,
          currency: "BRL",
          content_name: contentName || "Item arrematado",
          content_ids: contentId ? [String(contentId)] : undefined,
          content_type: "product",
          num_items: 1,
          order_id: orderId ? String(orderId) : undefined
        });
      }
    } catch (e) { /* pixel indisponível */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureIcButton);
  } else {
    ensureIcButton();
  }


  function formatBRL(value) {
    return "R$ " + value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  var params = new URLSearchParams(window.location.search);
  var productTitle = params.get("title") || "Item arrematado";
  var productPrice = parseFloat(params.get("price"));
  var productImg = params.get("img") || "";
  var productSlugParam = params.get("slug") || "";

  // As páginas de produto enviam imagens relativas à própria pasta. Como o
  // checkout fica em outra pasta, reconstruímos o caminho público do produto.
  if (productImg && !/^(?:https?:|data:|\/)/i.test(productImg) && productSlugParam) {
    productImg = "../product-" + productSlugParam + ".html/" + productImg.replace(/^\.\//, "");
  }

  // SMOKE TEST: com ?smoketest=1 na URL, a cobrança vira R$ 5,00 (em vez do valor
  // arrematado). Serve para testar o fluxo de pagamento real de ponta a ponta —
  // Pix gerado, pago e redirecionamento pro upsell — gastando só R$ 5.
  // Como isto sobrescreve productPrice, o resumo, o valor do Pix e a cobrança
  // enviada à Mangofy ficam todos em R$ 5,00 automaticamente.
  if (params.get("smoketest") === "1") {
    productPrice = 5;
    console.warn("[checkout] SMOKE TEST ativo: cobrando R$ 5,00 em vez do valor real.");
  }

  var ckProductImg = document.getElementById("ckProductImg");
  var ckProductTitle = document.getElementById("ckProductTitle");
  var ckSummaryPrice = document.getElementById("ckSummaryPrice");

  if (ckProductImg) {
    ckProductImg.src = productImg;
    ckProductImg.alt = productTitle;
  }
  if (ckProductTitle) ckProductTitle.textContent = productTitle;
  if (ckSummaryPrice) ckSummaryPrice.textContent = isNaN(productPrice) ? "R$ 0,00" : formatBRL(productPrice);

  /* ---------- Identificador do pedido ----------
     Criado ao abrir o checkout e reaproveitado como external_id da
     transacao, para a xTracky agrupar initiate_checkout, waiting_payment
     e paid sob o mesmo pedido. */
  function getOrderId() {
    var key = "arremata_order_id";
    var id;
    try { id = sessionStorage.getItem(key); } catch (e) { id = null; }
    if (!id) {
      id = "arremata-" + Date.now() + "-" + Math.floor(Math.random() * 100000);
      try { sessionStorage.setItem(key, id); } catch (e) { /* modo privado */ }
    }
    return id;
  }
  var orderId = getOrderId();

  /* ---------- Inicio de checkout (xTracky) ---------- */
  (function notifyCheckoutStarted() {
    if (isNaN(productPrice) || productPrice <= 0) return;
    var attribution = window.getAttribution ? window.getAttribution() : {};
    fetch("/api/checkout/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: orderId,
        price: productPrice,
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
      }),
      keepalive: true,
    }).catch(function () { /* rastreamento nunca bloqueia o checkout */ });

    if (typeof gtag === "function") {
      gtag("event", "conversion", {
        send_to: "AW-18375685275/vxGrCIak7-gcEJvpmrpE",
        transaction_id: orderId,
      });
      gtag("event", "conversion", {
        send_to: "AW-18414458230/BmLWCJrYhukcEPaq2cxE",
        transaction_id: orderId,
      });
    }
  })();

  /* ---------- "Filled" indicator on every field ---------- */
  function markFilled(input) {
    var field = input.closest(".checkout__field");
    if (!field) return;
    field.classList.toggle("is-filled", input.value.trim() !== "");
  }

  var allCheckoutInputs = Array.prototype.slice.call(document.querySelectorAll(".checkout__field input"));
  allCheckoutInputs.forEach(function (input) {
    input.addEventListener("input", function () { markFilled(input); });
    input.addEventListener("blur", function () { markFilled(input); });
  });

  /* ---------- CPF mask ---------- */
  var ckCpf = document.getElementById("ckCpf");
  if (ckCpf) {
    ckCpf.addEventListener("input", function () {
      var digits = ckCpf.value.replace(/\D/g, "").slice(0, 11);
      var formatted = digits;
      if (digits.length > 9) formatted = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, "$1.$2.$3-$4");
      else if (digits.length > 6) formatted = digits.replace(/(\d{3})(\d{3})(\d{1,3})/, "$1.$2.$3");
      else if (digits.length > 3) formatted = digits.replace(/(\d{3})(\d{1,3})/, "$1.$2");
      ckCpf.value = formatted;
    });
  }

  /* ---------- Phone mask ---------- */
  var ckPhone = document.getElementById("ckPhone");
  if (ckPhone) {
    ckPhone.addEventListener("input", function () {
      var digits = ckPhone.value.replace(/\D/g, "").slice(0, 11);
      var formatted = digits;
      if (digits.length > 10) formatted = digits.replace(/(\d{2})(\d{5})(\d{1,4})/, "($1) $2-$3");
      else if (digits.length > 6) formatted = digits.replace(/(\d{2})(\d{4})(\d{1,4})/, "($1) $2-$3");
      else if (digits.length > 2) formatted = digits.replace(/(\d{2})(\d{1,5})/, "($1) $2");
      else if (digits.length > 0) formatted = digits.replace(/(\d{1,2})/, "($1");
      ckPhone.value = formatted;
    });
  }

  /* ---------- CEP: auto-fill address, no button needed ---------- */
  var ckCep = document.getElementById("ckCep");
  var ckCepFeedback = document.getElementById("ckCepFeedback");
  var ckStreet = document.getElementById("ckStreet");
  var ckNeighborhood = document.getElementById("ckNeighborhood");
  var ckCity = document.getElementById("ckCity");

  function lookupCep(digits) {
    ckCepFeedback.textContent = "Buscando endereço...";
    ckCepFeedback.className = "checkout__cep-feedback";

    fetch("https://viacep.com.br/ws/" + digits + "/json/")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.erro) {
          ckCepFeedback.textContent = "CEP não encontrado. Preencha o endereço manualmente.";
          ckCepFeedback.className = "checkout__cep-feedback is-error";
          return;
        }
        if (ckStreet) { ckStreet.value = data.logradouro || ""; markFilled(ckStreet); }
        if (ckNeighborhood) { ckNeighborhood.value = data.bairro || ""; markFilled(ckNeighborhood); }
        if (ckCity) { ckCity.value = [data.localidade, data.uf].filter(Boolean).join(" - "); markFilled(ckCity); }
        ckCepFeedback.textContent = "Endereço preenchido automaticamente! Confirme o número e complemento.";
        ckCepFeedback.className = "checkout__cep-feedback is-success";
        var numberField = document.getElementById("ckNumber");
        if (numberField) numberField.focus();
      })
      .catch(function () {
        ckCepFeedback.textContent = "Não foi possível buscar o CEP agora. Preencha manualmente.";
        ckCepFeedback.className = "checkout__cep-feedback is-error";
      });
  }

  if (ckCep) {
    ckCep.addEventListener("input", function () {
      var digits = ckCep.value.replace(/\D/g, "").slice(0, 8);
      ckCep.value = digits.length > 5 ? digits.slice(0, 5) + "-" + digits.slice(5) : digits;
      ckCepFeedback.textContent = "";
      ckCepFeedback.className = "checkout__cep-feedback";
      if (digits.length === 8) lookupCep(digits);
    });
  }

  /* ---------- Submit: create the Pix charge ---------- */
  var checkoutForm = document.getElementById("checkoutForm");
  var checkoutBlock = document.getElementById("checkoutBlock");
  var checkoutSubmitBtn = document.getElementById("checkoutSubmitBtn");
  var checkoutSubmitError = document.getElementById("checkoutSubmitError");

  var pixBlock = document.getElementById("pixBlock");
  var pixStageLoading = document.getElementById("pixStageLoading");
  var pixStageReady = document.getElementById("pixStageReady");
  var pixStageApproved = document.getElementById("pixStageApproved");
  var pixStageFailed = document.getElementById("pixStageFailed");
  var pixAmount = document.getElementById("pixAmount");
  var pixQrImg = document.getElementById("pixQrImg");
  var pixCode = document.getElementById("pixCode");
  var pixCopyBtn = document.getElementById("pixCopyBtn");
  var pixFailedReason = document.getElementById("pixFailedReason");
  var pixRetryBtn = document.getElementById("pixRetryBtn");
  var ckOrderNumber = document.getElementById("ckOrderNumber");
  var pixProductName = document.getElementById("pixProductName");
  var tMin1 = document.getElementById("tMin1");
  var tMin2 = document.getElementById("tMin2");
  var tSec1 = document.getElementById("tSec1");
  var tSec2 = document.getElementById("tSec2");

  var pollTimer = null;
  var countdownTimer = null;
  var PIX_EXPIRY_MS = 10 * 60 * 1000;
  // So os botoes do cabecalho mostram o aviso de "vai perder a aprovacao"
  // enquanto o Pix desta tela estiver pendente (nao antes, nem depois).
  var pixPending = false;

  function showPixStage(stage) {
    [pixStageLoading, pixStageReady, pixStageApproved, pixStageFailed].forEach(function (s) {
      if (s) s.hidden = s !== stage;
    });
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function stopCountdown() {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
  }

  function startCountdown() {
    stopCountdown();
    if (!tMin1) return;
    var deadline = Date.now() + PIX_EXPIRY_MS;

    function tick() {
      var msLeft = deadline - Date.now();
      if (msLeft <= 0) {
        stopCountdown();
        stopPolling();
        pixPending = false;
        pixFailedReason.textContent = "O tempo de 10 minutos para pagamento expirou. Você pode gerar um novo Pix.";
        showPixStage(pixStageFailed);
        return;
      }
      var totalSeconds = Math.ceil(msLeft / 1000);
      var minutes = Math.floor(totalSeconds / 60);
      var seconds = totalSeconds % 60;
      var mm = (minutes < 10 ? "0" : "") + minutes;
      var ss = (seconds < 10 ? "0" : "") + seconds;
      tMin1.textContent = mm[0]; tMin2.textContent = mm[1];
      tSec1.textContent = ss[0]; tSec2.textContent = ss[1];
    }

    tick();
    countdownTimer = setInterval(tick, 1000);
  }

  function getTracking() {
    if (typeof window.getTrackingParams === "function") {
      try { return window.getTrackingParams(); } catch (e) { /* segue o fallback */ }
    }
    var q = new URLSearchParams(window.location.search);
    var stored = {};
    try { stored = JSON.parse(localStorage.getItem("arremata_tracking")) || {}; } catch (e) { stored = {}; }
    var keys = ["src", "sck", "xcod", "fbclid", "gclid", "ttclid", "utm_source", "utm_campaign", "utm_medium", "utm_content", "utm_term"];
    var out = {};
    keys.forEach(function (k) {
      var v = q.get(k) || stored[k] || "";
      if (!v) { try { v = localStorage.getItem(k) || ""; } catch (e) { v = ""; } }
      out[k] = v;
    });
    try { localStorage.setItem("arremata_tracking", JSON.stringify(out)); } catch (e) { /* modo privado */ }
    return out;
  }


  // Status que NAO sao venda. Qualquer outro status retornado pelo gateway
  // (paid, approved, completed, etc.) conta como pagamento confirmado.
  // Assim nenhuma venda real deixa de ser marcada por causa de um nome de
  // status diferente, e expirados/cancelados continuam fora da Utmify.
  var NOT_PAID_STATUSES = [
    "pending", "waiting", "waiting_payment", "awaiting_payment", "created", "new",
    "processing", "in_process", "in_analysis", "analysis", "review",
    "expired", "expirado", "cancelled", "canceled", "cancelado",
    "refused", "recusado", "denied", "declined", "failed", "failure", "error", "erro",
    "refunded", "reembolsado", "chargeback", "disputed", "unpaid", "not_paid"
  ];

  function isPaidStatus(s) {
    return !!s && NOT_PAID_STATUSES.indexOf(s) === -1;
  }

  function reportPaidOnce() {
    // Uma unica notificacao de venda paga por pedido (evita vendas duplicadas na Utmify).
    var order = null;
    try { order = JSON.parse(localStorage.getItem("arremata_order")) || null; } catch (e) { order = null; }
    if (!order || !order.orderId) return;
    var flag = "arremata_paid_sent_" + order.orderId;
    try { if (localStorage.getItem(flag)) return; localStorage.setItem(flag, "pending"); } catch (e) { /* modo privado */ }
    fetch("/api/utmify/paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
      keepalive: true
    }).then(function (res) {
      // So marcamos como enviado quando a Utmify confirma o recebimento.
      // Se falhar, a flag some e a venda e reenviada na proxima verificacao.
      try {
        if (res && res.ok) localStorage.setItem(flag, "1");
        else localStorage.removeItem(flag);
      } catch (e) { /* modo privado */ }
    }).catch(function () {
      try { localStorage.removeItem(flag); } catch (e) { /* modo privado */ }
    });
  }

  function pollStatus(transactionId, route, slug, amount) {
    stopPolling();
    var query = new URLSearchParams({ route: route || "" });
    pollTimer = setInterval(function () {
      var url = "/api/allowpay/status/" + encodeURIComponent(transactionId) + "?" + query.toString() + "&_=" + Date.now();
      fetch(url, { cache: "no-store" })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var raw = data.status;
          if (raw == null || raw === "") return;
          var current = String(raw).toLowerCase().trim();
          if (current === "waiting_payment") return;
          if (current !== "approved") {
            stopPolling();
            stopCountdown();
            pixPending = false;
            pixFailedReason.textContent = "Este Pix foi encerrado (" + current + "). Gere um novo pagamento para tentar novamente.";
            showPixStage(pixStageFailed);
            return;
          }

          stopPolling();
          stopCountdown();
          pixPending = false;

          // Facebook Purchase — dispara ANTES do redirect para a Utmify/upsell
          var paidOrder = null;
          try { paidOrder = JSON.parse(localStorage.getItem("arremata_order")) || null; } catch (e) { paidOrder = null; }
          var paidValue = (paidOrder && paidOrder.price != null) ? paidOrder.price : amount;
          var paidTitle = (paidOrder && paidOrder.title) ? paidOrder.title : productTitle;
          var paidSlug = (paidOrder && paidOrder.slug) ? paidOrder.slug : (slug || "");
          var paidOrderId = (paidOrder && paidOrder.orderId) ? paidOrder.orderId : orderId;
          fireFacebookPurchase(paidValue, paidTitle, paidSlug, paidOrderId);

          reportPaidOnce();
          window.location.href = getUrlWithUtm("/obrigado.html/index.html?title=" + encodeURIComponent(paidTitle) + "&price=" + encodeURIComponent(paidValue) + "&img=" + encodeURIComponent(productImg) + "&order=" + encodeURIComponent(transactionId));
        })
        .catch(function () { /* keep polling silently on transient network errors */ });
    }, 4000);
  }


  if (checkoutForm) {
    checkoutForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!checkoutForm.checkValidity()) {
        checkoutForm.reportValidity();
        return;
      }

      checkoutSubmitBtn.disabled = true;
      checkoutSubmitBtn.textContent = "Gerando pagamento...";
      checkoutSubmitError.hidden = true;

      var slugMatch = productSlugParam ? [null, productSlugParam] : productImg.match(/img\/products\/([a-z0-9-]+)\//);

      var attribution = window.getAttribution ? window.getAttribution() : {};

      var buyer = {
        name: document.getElementById("ckName").value.trim(),
        email: document.getElementById("ckEmail").value.trim(),
        cpf: document.getElementById("ckCpf").value,
        phone: document.getElementById("ckPhone").value,
      };
      // Mantém os dados do comprador para recuperar o pedido nesta sessão.
      try { localStorage.setItem("arremata_buyer", JSON.stringify(buyer)); } catch (e) { /* modo privado */ }

      fetch("/api/allowpay/create-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round((isNaN(productPrice) ? 0 : productPrice) * 100),
          description: productTitle,
          customer: {
            name: buyer.name,
            email: buyer.email,
            cellphone: buyer.phone,
            taxId: buyer.cpf
          }
        }),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          checkoutSubmitBtn.disabled = false;
          checkoutSubmitBtn.textContent = "Finalizar pedido";

          if (!result.ok) {
            checkoutSubmitError.textContent = result.data.error || "Não foi possível gerar o pagamento agora. Tente novamente.";
            checkoutSubmitError.hidden = false;
            return;
          }

          if (checkoutBlock) checkoutBlock.hidden = true;
          if (pixBlock) pixBlock.hidden = false;
          window.scrollTo({ top: 0, behavior: "smooth" });

          var checkoutMainTitle = document.getElementById("checkoutMainTitle");
          var checkoutMainSub = document.getElementById("checkoutMainSub");
          if (checkoutMainTitle) {
            checkoutMainTitle.textContent = "Falta apenas finalizar o pagamento via Pix";
            checkoutMainTitle.classList.add("is-pix-mode");
          }
          if (checkoutMainSub) {
            checkoutMainSub.textContent = "Copie o código abaixo e cole no app do seu banco para concluir.";
            checkoutMainSub.classList.add("is-pix-mode");
          }

          if (ckOrderNumber) ckOrderNumber.textContent = result.data.txid;
          if (pixAmount) pixAmount.textContent = isNaN(productPrice) ? "R$ 0,00" : formatBRL(productPrice);
          if (pixProductName) pixProductName.textContent = productTitle;
          if (pixQrImg) pixQrImg.src = result.data.pix_qr_code;
          if (pixCode) pixCode.value = result.data.pix_code;

          fireUtmifyIC();
          // Facebook InitiateCheckout no momento em que o Pix é gerado
          fireFacebookIC(
            isNaN(productPrice) ? 0 : productPrice,
            productTitle,
            slugMatch ? slugMatch[1] : ""
          );

          try {
            localStorage.setItem("arremata_order", JSON.stringify({
              orderId: orderId,
              price: isNaN(productPrice) ? 0 : productPrice,
              title: productTitle,
              slug: slugMatch ? slugMatch[1] : "",
              name: buyer.name,
              email: buyer.email,
              phone: buyer.phone,
              cpf: buyer.cpf,
              createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
              txId: String(result.data.txid || ""),
              route: String(result.data.route || ""),
              tracking: getTracking()
            }));
          } catch (e) { /* modo privado */ }

          showPixStage(pixStageReady);
          pixPending = true;
          pollStatus(result.data.txid, result.data.route, slugMatch ? slugMatch[1] : "", productPrice);
          startCountdown();

          if (typeof gtag === "function") {
            gtag("event", "conversion", {
              send_to: "AW-18375685275/EVBtCJDA7-gcEJvpmrpE",
              transaction_id: orderId,
            });
            gtag("event", "conversion", {
              send_to: "AW-18414458230/iHrTCNnhhukcEPaq2cxE",
              transaction_id: orderId,
            });
          }
        })
        .catch(function (err) {
          console.error("Erro ao gerar pagamento Pix:", err);
          checkoutSubmitBtn.disabled = false;
          checkoutSubmitBtn.textContent = "Finalizar pedido";
          checkoutSubmitError.textContent = window.location.protocol === "file:"
            ? "Abra o checkout pelo domínio publicado na Vercel. O pagamento não funciona abrindo o arquivo diretamente."
            : "Não foi possível conectar ao servidor de pagamento. Verifique se as funções da Vercel estão publicadas e tente novamente.";
          checkoutSubmitError.hidden = false;
        });
    });
  }

  var copyPopupOverlay = document.getElementById("copyPopupOverlay");

  if (pixCopyBtn) {
    var pixCopyIcon = pixCopyBtn.querySelector("use");
    var pixCopyLabel = pixCopyBtn.querySelector("span");
    pixCopyBtn.addEventListener("click", function () {
      pixCode.select();
      navigator.clipboard.writeText(pixCode.value).then(function () {
        pixCopyLabel.textContent = "Código copiado!";
        pixCopyIcon.setAttribute("href", "#icon-check");
        pixCopyBtn.classList.add("is-copied");
        setTimeout(function () {
          pixCopyLabel.textContent = "Copiar código Pix";
          pixCopyIcon.setAttribute("href", "#icon-copy");
          pixCopyBtn.classList.remove("is-copied");
        }, 2000);
        if (copyPopupOverlay) copyPopupOverlay.classList.add("is-open");
      });
    });
  }

  if (pixRetryBtn) {
    pixRetryBtn.addEventListener("click", function () {
      stopPolling();
      stopCountdown();
      pixPending = false;
      showPixStage(null);
      if (pixBlock) pixBlock.hidden = true;
      if (checkoutBlock) checkoutBlock.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- Aviso ao tentar sair com Pix pendente ---------- */
  (function () {
    var leavePopupOverlay = document.getElementById("leavePopupOverlay");
    var leavePopupMsg = document.getElementById("leavePopupMsg");
    var leavePopupStay = document.getElementById("leavePopupStay");
    var leavePopupLeave = document.getElementById("leavePopupLeave");
    if (!leavePopupOverlay) return;

    function openLeavePopup() {
      var produto = pixProductName ? pixProductName.textContent : "este produto";
      var valor = pixAmount ? pixAmount.textContent : "o valor arrematado";
      leavePopupMsg.textContent = "Se você sair agora, vai perder a aprovação que conseguiu para comprar " + produto + " por " + valor + ".";
      leavePopupOverlay.classList.add("is-open");
    }
    function closeLeavePopup() { leavePopupOverlay.classList.remove("is-open"); }

    // Fase de captura no document: intercepta antes do listener do menu
    // (em main.js) rodar, pra nao abrir a navegacao de categorias junto.
    document.addEventListener("click", function (e) {
      if (!pixPending) return;
      var trigger = e.target.closest("#mobileMenuBtn, #headerLogoLink, #headerAccountLink, #headerFavLink, #headerCartLink");
      if (!trigger) return;
      e.preventDefault();
      e.stopPropagation();
      openLeavePopup();
    }, true);

    if (leavePopupStay) leavePopupStay.addEventListener("click", closeLeavePopup);
    if (leavePopupLeave) leavePopupLeave.addEventListener("click", function () {
      window.location.href = "index.html";
    });
    leavePopupOverlay.addEventListener("click", function (e) {
      if (e.target === leavePopupOverlay) closeLeavePopup();
    });
  })();

  /* ---------- Popup de "codigo copiado" (fecha pelo X ou arrastando) ---------- */
  (function () {
    var overlay = document.getElementById("copyPopupOverlay");
    var closeX = document.getElementById("copyPopupCloseX");
    var track = document.getElementById("copySliderTrack");
    var slider = document.getElementById("copySliderBtn");
    if (!overlay || !slider) return;

    var DARK = [23, 164, 82];
    var LIGHT = [217, 242, 227];

    function closePopup() {
      overlay.classList.remove("is-open");
      resetSlider();
    }
    function resetSlider() {
      slider.classList.remove("is-dragging");
      slider.classList.add("is-snapping");
      slider.style.transform = "translateX(0)";
      slider.style.backgroundColor = "rgb(" + DARK.join(",") + ")";
      setTimeout(function () { slider.classList.remove("is-snapping"); }, 250);
    }

    if (closeX) closeX.addEventListener("click", closePopup);

    var dragging = false;
    var startX = 0;
    var maxDrag = 0;

    function onPointerDown(e) {
      dragging = true;
      startX = e.clientX;
      maxDrag = track.clientWidth - slider.clientWidth;
      slider.classList.add("is-dragging");
      slider.classList.remove("is-snapping");
      slider.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e) {
      if (!dragging) return;
      var delta = Math.min(0, Math.max(-maxDrag, e.clientX - startX));
      var progress = maxDrag > 0 ? Math.abs(delta) / maxDrag : 0;
      slider.style.transform = "translateX(" + delta + "px)";
      var mixed = DARK.map(function (c, i) { return Math.round(c + (LIGHT[i] - c) * progress); });
      slider.style.backgroundColor = "rgb(" + mixed.join(",") + ")";
      slider.dataset.progress = progress;
    }
    function onPointerUp(e) {
      if (!dragging) return;
      dragging = false;
      var moved = Math.abs(e.clientX - startX);
      var progress = parseFloat(slider.dataset.progress || "0");
      if (moved < 6 || progress > 0.85) {
        closePopup();
      } else {
        resetSlider();
      }
    }

    slider.addEventListener("pointerdown", onPointerDown);
    slider.addEventListener("pointermove", onPointerMove);
    slider.addEventListener("pointerup", onPointerUp);
    slider.addEventListener("pointercancel", onPointerUp);
  })();


  // Recuperacao de vendas pagas fora da pagina: se o cliente fechou o checkout
  // e pagou depois, na volta ao site conferimos o ultimo pedido e enviamos a
  // venda para a Utmify caso o gateway ja tenha confirmado o pagamento.
  (function recoverPendingSale() {
    var order = null;
    try { order = JSON.parse(localStorage.getItem("arremata_order")) || null; } catch (e) { order = null; }
    if (!order || !order.orderId || !order.txId) return;
    var flag = "arremata_paid_sent_" + order.orderId;
    try { if (localStorage.getItem(flag) === "1") return; } catch (e) { /* modo privado */ }
    if (!order.route) return;
    fetch("/api/allowpay/status/" + encodeURIComponent(order.txId) + "?route=" + encodeURIComponent(order.route) + "&_=" + Date.now(), { cache: "no-store" })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var raw = data && data.status;
        if (raw == null || raw === "") return;
        if (String(raw).toLowerCase().trim() !== "approved") return;
        reportPaidOnce();
      })
      .catch(function () { /* silencioso */ });
  })();

})();
