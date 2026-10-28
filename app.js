/*
 * Parque Inteligente – interface da aplicação (sem dependências).
 * Os dados e o login vêm de api.js. Os idiomas vêm de i18n.js.
 */
(function () {
  "use strict";

  var cfg = window.Api.config;

  var state = {
    lang: "pt",
    floor: null,
    view: "plan",
    spots: [],
    prev: null,        // id -> ocupado, para avisar quando muda
    user: null,
    guest: false,
    updatedAt: null,
    loginErrorKey: null,
    bannerKey: null
  };

  var $ = function (id) { return document.getElementById(id); };

  var store = {
    get: function (area, k) { try { return window[area].getItem(k); } catch (e) { return null; } },
    set: function (area, k, v) { try { window[area].setItem(k, v); } catch (e) { /* ignora */ } },
    del: function (area, k) { try { window[area].removeItem(k); } catch (e) { /* ignora */ } }
  };

  // ---------- Idiomas ----------
  function t(key, vars) {
    var dict = window.I18N[state.lang] || window.I18N.en;
    var text = dict[key];
    if (text === undefined) { text = window.I18N.en[key]; }
    if (text === undefined) { text = key; }
    if (vars) {
      Object.keys(vars).forEach(function (k) { text = text.split("{" + k + "}").join(vars[k]); });
    }
    return text;
  }

  function detectLang() {
    var saved = store.get("localStorage", "lang");
    if (saved && window.I18N[saved]) { return saved; }
    var nav = (navigator.language || "en").slice(0, 2).toLowerCase();
    return window.I18N[nav] ? nav : "en";
  }

  function buildLangSelect() {
    var sel = $("lang");
    sel.innerHTML = "";
    Object.keys(window.I18N).forEach(function (code) {
      var o = document.createElement("option");
      o.value = code;
      o.textContent = window.I18N[code].langName;
      sel.appendChild(o);
    });
    sel.value = state.lang;
    sel.addEventListener("change", function () {
      state.lang = sel.value;
      store.set("localStorage", "lang", state.lang);
      applyStatic();
      render();
    });
  }

  function applyStatic() {
    document.documentElement.lang = state.lang;
    document.title = t("appTitle");
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute("data-i18n"));
    }
    renderLoginTexts();
    renderUserBox();
    renderBanner();
  }

  // ---------- Dados ----------
  function floorsList() {
    var seen = {};
    state.spots.forEach(function (s) { seen[s.floor] = true; });
    return Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
  }

  function spotsOfFloor(n) {
    return state.spots
      .filter(function (s) { return s.floor === n; })
      .sort(function (a, b) { return a.row - b.row || a.col - b.col; });
  }

  function counts(list) {
    var occ = list.filter(function (s) { return s.occupied; }).length;
    return { total: list.length, occ: occ, free: list.length - occ };
  }

  function isAdmin() { return !!state.user && state.user.role === "admin"; }

  function refresh() {
    return window.Api.getSpots()
      .then(function (spots) {
        if (state.bannerKey === "offline") { setBanner(null); }
        applySpots(spots);
      })
      .catch(function () { setBanner("offline"); });
  }

  function applySpots(spots) {
    var msgs = [];
    var now = {};
    spots.forEach(function (s) { now[s.id] = !!s.occupied; });
    if (state.prev) {
      spots.forEach(function (s) {
        if (state.prev[s.id] !== undefined && state.prev[s.id] !== now[s.id]) {
          msgs.push(t(now[s.id] ? "spotNowOccupied" : "spotNowFree", { id: s.id }));
        }
      });
    }
    state.prev = now;
    state.spots = spots;
    state.updatedAt = new Date();
    var floors = floorsList();
    if (floors.length && floors.indexOf(state.floor) < 0) { state.floor = floors[0]; }
    if (msgs.length) { $("live").textContent = msgs.join(" "); }
    render();
  }

  // ---------- Avisos ----------
  function setBanner(key) {
    state.bannerKey = key;
    renderBanner();
  }

  function renderBanner() {
    var b = $("offline");
    if (!state.bannerKey) { b.hidden = true; return; }
    b.textContent = t(state.bannerKey);
    b.hidden = false;
  }

  // ---------- Desenho ----------
  var SVG_NS = "http://www.w3.org/2000/svg";

  function icon(occupied) {
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    if (occupied) {
      var r = document.createElementNS(SVG_NS, "rect");
      r.setAttribute("x", "6"); r.setAttribute("y", "3");
      r.setAttribute("width", "12"); r.setAttribute("height", "18");
      r.setAttribute("rx", "4");
      r.setAttribute("fill", "currentColor");
      svg.appendChild(r);
    } else {
      var p = document.createElementNS(SVG_NS, "path");
      p.setAttribute("d", "M5 12.5l4.5 4.5L19 7.5");
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", "currentColor");
      p.setAttribute("stroke-width", "3");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      svg.appendChild(p);
    }
    return svg;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }

  function spotContent(s) {
    var frag = document.createDocumentFragment();
    frag.appendChild(el("span", "spot-id", s.id));
    frag.appendChild(icon(s.occupied));
    frag.appendChild(el("span", "spot-status", t(s.occupied ? "statusOccupied" : "statusFree")));
    if (s.accessible) {
      var tag = el("span", "spot-tag", t("accessibleTag"));
      tag.setAttribute("title", t("accessibleSpot"));
      frag.appendChild(tag);
    }
    return frag;
  }

  function renderTabs(floors) {
    var box = $("floor-tabs");
    box.innerHTML = "";
    floors.forEach(function (n) {
      var c = counts(spotsOfFloor(n));
      var b = el("button", "tab", t("floorFree", { n: n, free: c.free }));
      b.type = "button";
      b.setAttribute("aria-pressed", String(n === state.floor));
      b.addEventListener("click", function () { state.floor = n; render(); });
      box.appendChild(b);
    });
  }

  function renderSummary(list) {
    var c = counts(list);
    $("n-free").textContent = c.free;
    $("n-occ").textContent = c.occ;
    $("n-total").textContent = c.total;
    $("lcd-free").textContent = c.free;
    $("lcd-total").textContent = c.total;
    $("lcd-floor").textContent = state.floor === null ? "" : t("floorN", { n: state.floor }).toUpperCase();
  }

  function renderPlan(list) {
    var box = $("plan");
    box.innerHTML = "";
    var rows = {};
    var order = [];
    list.forEach(function (s) {
      if (!rows[s.row]) { rows[s.row] = []; order.push(s.row); }
      rows[s.row].push(s);
    });
    var admin = isAdmin();
    order.forEach(function (r, idx) {
      var ul = el("ul", "row");
      var cols = Math.max.apply(null, rows[r].map(function (s) { return s.col; })) + 1;
      ul.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0, 1fr))";
      rows[r].forEach(function (s) {
        var li = el("li", "spot " + (s.occupied ? "occupied" : "free"));
        li.style.gridColumn = String(s.col + 1);
        var inner;
        if (admin) {
          inner = el("button", "spot-btn");
          inner.type = "button";
          inner.setAttribute("data-id", s.id);
          inner.addEventListener("click", function () { toggleSpot(s); });
        } else {
          inner = el("div", "spot-inner");
        }
        inner.appendChild(spotContent(s));
        li.appendChild(inner);
        ul.appendChild(li);
      });
      box.appendChild(ul);
      if (idx < order.length - 1) { box.appendChild(el("div", "lane", t("lane"))); }
    });
  }

  function renderList(list) {
    var box = $("list");
    box.innerHTML = "";
    var wrap = el("div", "table-wrap");
    var table = el("table");
    var head = el("tr");
    ["colSpace", "colStatus", "colType"].forEach(function (k) {
      var th = el("th", null, t(k));
      th.setAttribute("scope", "col");
      head.appendChild(th);
    });
    var thead = el("thead"); thead.appendChild(head);
    table.appendChild(thead);
    var tbody = el("tbody");
    list.forEach(function (s) {
      var tr = el("tr");
      var th = el("th", null, s.id);
      th.setAttribute("scope", "row");
      tr.appendChild(th);
      tr.appendChild(el("td", s.occupied ? "occupied" : "free", t(s.occupied ? "statusOccupied" : "statusFree")));
      tr.appendChild(el("td", null, t(s.accessible ? "typeAccessible" : "typeNormal")));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    box.appendChild(wrap);
  }

  function render() {
    if (!state.user && !state.guest) { return; }
    var active = document.activeElement;
    var keepId = active && active.getAttribute ? active.getAttribute("data-id") : null;

    var floors = floorsList();
    var list = state.floor === null ? [] : spotsOfFloor(state.floor);
    renderTabs(floors);
    renderSummary(list);
    renderPlan(list);
    renderList(list);
    $("plan").hidden = state.view !== "plan";
    $("list").hidden = state.view !== "list";
    $("view-plan").setAttribute("aria-pressed", String(state.view === "plan"));
    $("view-list").setAttribute("aria-pressed", String(state.view === "list"));
    $("admin-help").hidden = !isAdmin() || state.view !== "plan";
    if (state.updatedAt) {
      $("updated").textContent = t("updated", {
        time: state.updatedAt.toLocaleTimeString(state.lang, { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      });
    }
    if (keepId) {
      var again = document.querySelector('[data-id="' + keepId + '"]');
      if (again) { again.focus(); }
    }
  }

  // ---------- Administrador ----------
  function toggleSpot(s) {
    window.Api.setSpot(s.id, !s.occupied)
      .then(function () { if (state.bannerKey === "saveFailed") { setBanner(null); } return refresh(); })
      .catch(function () { setBanner("saveFailed"); });
  }

  // ---------- Login ----------
  function renderLoginTexts() {
    var err = $("login-error");
    if (state.loginErrorKey) {
      err.textContent = t(state.loginErrorKey);
      err.hidden = false;
    } else {
      err.hidden = true;
    }
    var hint = $("demo-hint");
    var h = window.Api.demoHint();
    if (h) {
      hint.textContent = t("demoHint", { email: h.email, password: h.password });
      hint.hidden = false;
    } else {
      hint.hidden = true;
    }
  }

  function renderUserBox() {
    var box = $("user-box");
    var openBtn = $("btn-login-open");
    if (state.user) {
      var role = t(state.user.role === "admin" ? "roleAdmin" : "roleDriver");
      $("user-name").textContent = state.user.name + " · " + role;
      box.hidden = false;
      openBtn.hidden = true;
    } else {
      box.hidden = true;
      openBtn.hidden = !state.guest;
    }
  }

  function showScreen() {
    var inApp = !!state.user || state.guest;
    $("view-login").hidden = inApp;
    $("view-app").hidden = !inApp;
    renderUserBox();
    if (inApp) {
      render();
    } else {
      $("email").focus();
    }
  }

  function goLogin() {
    state.guest = false;
    store.del("sessionStorage", "guest");
    state.loginErrorKey = null;
    renderLoginTexts();
    showScreen();
  }

  function onLogin(ev) {
    ev.preventDefault();
    var email = $("email").value.trim();
    var pass = $("password").value;
    if (!email || !pass) {
      state.loginErrorKey = "loginEmpty";
      renderLoginTexts();
      (email ? $("password") : $("email")).focus();
      return;
    }
    var btn = $("login-submit");
    btn.disabled = true;
    btn.textContent = t("signingIn");
    window.Api.login(email, pass)
      .then(function (user) {
        state.user = user;
        state.guest = false;
        state.loginErrorKey = null;
        $("password").value = "";
        renderLoginTexts();
        showScreen();
        refresh();
      })
      .catch(function (err) {
        state.loginErrorKey = err && err.code === "invalid" ? "loginInvalid" : "loginFailed";
        renderLoginTexts();
        $("password").focus();
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = t("signIn");
      });
  }

  function onLogout() {
    window.Api.logout().then(function () {
      state.user = null;
      state.guest = false;
      store.del("sessionStorage", "guest");
      showScreen();
    });
  }

  // ---------- Opções de acessibilidade ----------
  function bindToggle(btnId, storeKey, attr, onValue) {
    var btn = $(btnId);
    var on = store.get("localStorage", storeKey) === "1";
    function apply() {
      btn.setAttribute("aria-pressed", String(on));
      if (on) { document.documentElement.setAttribute(attr, onValue); }
      else { document.documentElement.removeAttribute(attr); }
    }
    btn.addEventListener("click", function () {
      on = !on;
      store.set("localStorage", storeKey, on ? "1" : "0");
      apply();
    });
    apply();
  }

  // ---------- Arranque ----------
  function init() {
    state.lang = detectLang();
    state.user = window.Api.currentUser();
    state.guest = store.get("sessionStorage", "guest") === "1";

    buildLangSelect();
    applyStatic();
    bindToggle("btn-size", "bigText", "data-size", "large");
    bindToggle("btn-contrast", "contrast", "data-contrast", "high");

    $("view-plan").addEventListener("click", function () { state.view = "plan"; render(); });
    $("view-list").addEventListener("click", function () { state.view = "list"; render(); });

    $("login-form").addEventListener("submit", onLogin);
    $("show-pass").addEventListener("change", function () {
      $("password").type = $("show-pass").checked ? "text" : "password";
    });
    $("btn-guest").addEventListener("click", function () {
      state.guest = true;
      store.set("sessionStorage", "guest", "1");
      showScreen();
      refresh();
    });
    $("btn-login-open").addEventListener("click", goLogin);
    $("btn-logout").addEventListener("click", onLogout);

    showScreen();
    refresh();
    window.setInterval(refresh, cfg.pollMs);
  }

  init();
})();