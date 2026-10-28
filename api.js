/*
 * Camada de dados: tudo o que a app lê ou escreve passa por aqui.
 *
 *  - apiBase = null  -> modo demonstração (dados e contas guardados no navegador).
 *  - apiBase = "https://o-teu-servidor/api" -> usa a base de dados real.
 *
 * Contrato com o servidor (ver README):
 *   POST  /auth/login      { email, password }  -> { token, user: { email, name, role } }
 *   GET   /spots           -> { spots: [ { id, floor, row, col, accessible, occupied } ] }
 *   PATCH /spots/:id       { occupied }  (só administradores, com token)
 *
 * Os utilizadores de demonstração servem só para treinar. Numa versão real,
 * as palavras-passe ficam na base de dados (com hash) e nunca no código da página.
 */
(function () {
  "use strict";

  var CONFIG = {
    apiBase: null,   // ex.: "https://parque.exemplo.pt/api"
    pollMs: 2000
  };

  var DEMO_USERS = [
    { email: "admin@parque.pt", password: "demo1234", name: "Admin", role: "admin" },
    { email: "condutor@parque.pt", password: "demo1234", name: "Demo", role: "driver" }
  ];

  // Planta de demonstração: piso, linha, coluna, acessível, ocupado
  var DEMO_SPOTS = [
    ["A1", 0, 0, 0, true, false], ["A2", 0, 0, 1, false, true], ["A3", 0, 0, 2, false, false], ["A4", 0, 0, 3, false, true],
    ["B1", 0, 1, 0, false, true], ["B2", 0, 1, 1, false, false], ["B3", 0, 1, 2, false, false], ["B4", 0, 1, 3, false, false],
    ["C1", 1, 0, 0, true, false], ["C2", 1, 0, 1, false, false], ["C3", 1, 0, 2, false, true], ["C4", 1, 0, 3, false, false],
    ["D1", 1, 1, 0, false, false], ["D2", 1, 1, 1, false, false], ["D3", 1, 1, 2, false, false], ["D4", 1, 1, 3, false, false]
  ].map(function (s) {
    return { id: s[0], floor: s[1], row: s[2], col: s[3], accessible: s[4], occupied: s[5] };
  });

  var store = {
    get: function (area, k) { try { return window[area].getItem(k); } catch (e) { return null; } },
    set: function (area, k, v) { try { window[area].setItem(k, v); } catch (e) { /* ignora */ } },
    del: function (area, k) { try { window[area].removeItem(k); } catch (e) { /* ignora */ } }
  };

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  // ---------- Modo demonstração ----------
  var demo = {
    login: function (email, password) {
      var e = String(email).trim().toLowerCase();
      for (var i = 0; i < DEMO_USERS.length; i++) {
        var u = DEMO_USERS[i];
        if (u.email === e && u.password === password) {
          var user = { email: u.email, name: u.name, role: u.role };
          store.set("sessionStorage", "user", JSON.stringify(user));
          return Promise.resolve(user);
        }
      }
      var err = new Error("invalid");
      err.code = "invalid";
      return Promise.reject(err);
    },
    logout: function () { store.del("sessionStorage", "user"); return Promise.resolve(); },
    currentUser: function () {
      var raw = store.get("sessionStorage", "user");
      if (!raw) { return null; }
      try { return JSON.parse(raw); } catch (e) { return null; }
    },
    getSpots: function () {
      var raw = store.get("localStorage", "spots_v2");
      if (raw) {
        try { return Promise.resolve(JSON.parse(raw)); } catch (e) { /* recria */ }
      }
      var fresh = clone(DEMO_SPOTS);
      store.set("localStorage", "spots_v2", JSON.stringify(fresh));
      return Promise.resolve(fresh);
    },
    setSpot: function (id, occupied) {
      return demo.getSpots().then(function (spots) {
        spots.forEach(function (s) { if (s.id === id) { s.occupied = occupied; } });
        store.set("localStorage", "spots_v2", JSON.stringify(spots));
        return spots;
      });
    },
    hint: function () { return { email: DEMO_USERS[0].email, password: DEMO_USERS[0].password }; }
  };

  // ---------- Servidor / base de dados real ----------
  function http(method, path, body) {
    var headers = { "Accept": "application/json" };
    var token = store.get("sessionStorage", "token");
    if (token) { headers["Authorization"] = "Bearer " + token; }
    if (body !== undefined) { headers["Content-Type"] = "application/json"; }
    return fetch(CONFIG.apiBase + path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) {
        var err = new Error("HTTP " + r.status);
        err.code = r.status === 401 || r.status === 403 ? "invalid" : "http";
        throw err;
      }
      return r.status === 204 ? null : r.json();
    });
  }

  var rest = {
    login: function (email, password) {
      return http("POST", "/auth/login", { email: email, password: password }).then(function (data) {
        store.set("sessionStorage", "token", data.token);
        store.set("sessionStorage", "user", JSON.stringify(data.user));
        return data.user;
      });
    },
    logout: function () {
      store.del("sessionStorage", "token");
      store.del("sessionStorage", "user");
      return Promise.resolve();
    },
    currentUser: demo.currentUser,
    getSpots: function () { return http("GET", "/spots").then(function (d) { return d.spots || []; }); },
    setSpot: function (id, occupied) {
      return http("PATCH", "/spots/" + encodeURIComponent(id), { occupied: occupied });
    },
    hint: function () { return null; }
  };

  var impl = CONFIG.apiBase ? rest : demo;

  window.Api = {
    config: CONFIG,
    isDemo: !CONFIG.apiBase,
    login: impl.login,
    logout: impl.logout,
    currentUser: impl.currentUser,
    getSpots: impl.getSpots,
    setSpot: impl.setSpot,
    demoHint: impl.hint
  };
})();