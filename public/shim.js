/* Zamjena za Claudeov "db / user / downloads": podaci idu kroz /api (Netlify), pristup preko PIN-a. */
(function () {
  var TK = "dpsToken", token = null, role = null, ready, resolveReady, lastPoll = 0, lastAct = Date.now();
  ready = new Promise(function (r) { resolveReady = r; });
  try { token = localStorage.getItem(TK); } catch (e) {}

  function api(body, noAuth) {
    var h = { "content-type": "application/json" };
    if (!noAuth && token) h.authorization = "Bearer " + token;
    return fetch("/api", { method: "POST", headers: h, body: JSON.stringify(body) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && !noAuth) { dropToken(); showLogin("Sesija je istekla. Upiši PIN."); var e = new Error("auth"); e.code = "auth"; throw e; }
        if (!r.ok) { var e2 = new Error(j.error || "greška"); e2.code = r.status === 403 ? "zabranjeno" : (j.error || r.status); e2.status = r.status; throw e2; }
        return j;
      });
    });
  }
  function dropToken() { token = null; role = null; try { localStorage.removeItem(TK); } catch (e) {} }

  /* ---------- prijava ---------- */
  var ov;
  function showLogin(msg) {
    if (!ov) {
      ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;z-index:100;background:var(--bg);display:flex;align-items:center;justify-content:center;padding:20px";
      ov.innerHTML = '<form style="width:100%;max-width:340px;background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:22px;text-align:center">' +
        '<img src="logo.png" alt="DPS Zagreb" style="width:220px;max-width:80%;height:auto"><h1 style="font-size:1.1rem;margin:8px 0 4px">Oprema</h1>' +
        '<div class="mu" id="lgm" style="margin-bottom:14px">Upiši PIN za pristup.</div>' +
        '<input id="lgp" type="password" inputmode="numeric" autocomplete="current-password" placeholder="PIN" style="text-align:center;font-size:1.4rem;letter-spacing:.3em">' +
        '<button class="b" id="lgb" style="width:100%;margin-top:12px">Prijava</button></form>';
      document.body.appendChild(ov);
      ov.querySelector("form").onsubmit = function (e) { e.preventDefault(); doLogin(); };
    }
    ov.style.display = "flex";
    document.getElementById("lgm").textContent = msg || "Upiši PIN za pristup.";
    var p = document.getElementById("lgp"); p.value = ""; setTimeout(function () { p.focus(); }, 50);
  }
  function doLogin() {
    var p = document.getElementById("lgp"), b = document.getElementById("lgb");
    if (!p.value) return;
    b.disabled = true; b.textContent = "Provjeravam…";
    api({ op: "login", pin: p.value }, true).then(function (j) {
      token = j.token; role = j.role; try { localStorage.setItem(TK, token); } catch (e) {}
      ov.style.display = "none"; b.disabled = false; b.textContent = "Prijava"; started(); poll(true);
    }).catch(function (e) {
      b.disabled = false; b.textContent = "Prijava";
      document.getElementById("lgm").textContent = (e && e.message) || "Prijava nije uspjela.";
      p.value = ""; p.focus();
    });
  }
  var didStart = false;
  function started() { if (!didStart) { didStart = true; resolveReady(); } setupSettings(); }
  function boot() {
    if (!token) return showLogin();
    api({ op: "ver" }).then(function (j) { role = j.role; started(); }).catch(function (e) {
      if (!e || e.code !== "auth") showLogin("Nema veze s poslužiteljem. Provjeri internet pa upiši PIN.");
    });
  }

  /* ---------- baza ---------- */
  var subs = {}, cache = {}, inflight = {}, lastVer = {};
  function snap(col, s) {
    if (s.id) { var d = (cache[col] || []).filter(function (x) { return x.id === s.id; })[0]; return { exists: !!d, id: s.id, data: function () { return d ? d.data : undefined; } }; }
    return { docs: (cache[col] || []).map(function (d) { return { id: d.id, data: function () { return d.data; } }; }) };
  }
  function fire(col) { (subs[col] || []).forEach(function (s) { try { s.cb(snap(col, s)); } catch (e) { console.error(e); } }); }
  function fetchCol(col) {
    if (inflight[col]) return inflight[col];
    inflight[col] = api({ op: "list", col: col }).then(function (j) { cache[col] = j.docs; fire(col); }).catch(function (e) {
      (subs[col] || []).forEach(function (s) { if (s.err) s.err(e); });
    }).then(function () { delete inflight[col]; });
    return inflight[col];
  }
  function write(col, op, id, data, merge) {
    var body = { op: op, col: col }; if (id) body.id = id; if (data !== undefined) body.data = data; if (merge) body.merge = true;
    return ready.then(function () { return api(body); }).then(function (j) { return fetchCol(col).then(function () { return { id: j.id }; }); });
  }
  function sub(col, id, cb, err) {
    var s = { cb: cb, err: err, id: id }; (subs[col] = subs[col] || []).push(s);
    ready.then(function () { if (cache[col]) cb(snap(col, s)); else fetchCol(col); });
    return function () { subs[col] = subs[col].filter(function (x) { return x !== s; }); };
  }
  function docRef(col, id) {
    return {
      set: function (d, o) { return write(col, "set", id, d, o && o.merge); },
      update: function (d) { return write(col, "update", id, d); },
      delete: function () { return write(col, "delete", id); },
      onSnapshot: function (cb, err) { return sub(col, id, cb, err); }
    };
  }
  var db = {
    collection: function (col) {
      return { doc: function (id) { return docRef(col, id); }, add: function (d) { return write(col, "add", null, d); }, onSnapshot: function (cb, err) { return sub(col, null, cb, err); } };
    },
    doc: function (path) { var p = path.split("/"); return docRef(p[0], p[1]); }
  };

  function poll(force) {
    if (!token || document.hidden) return;
    var now = Date.now(); if (!force && now - lastPoll < 2500) return; lastPoll = now;
    api({ op: "ver" }).then(function (j) {
      role = j.role;
      Object.keys(subs).forEach(function (col) {
        if (!subs[col].length) return;
        if (j.v[col] !== lastVer[col]) { lastVer[col] = j.v[col]; fetchCol(col); }
      });
    }).catch(function () {});
  }
  setInterval(function () { if (Date.now() - lastAct < 5 * 60e3) poll(); }, 12000);
  function act() { var idle = Date.now() - lastAct > 60e3; lastAct = Date.now(); if (idle) poll(true); }
  ["pointerdown", "keydown", "touchstart"].forEach(function (ev) { document.addEventListener(ev, act, { passive: true }); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) { lastAct = Date.now(); poll(true); } });
  window.addEventListener("focus", function () { lastAct = Date.now(); poll(true); });

  /* ---------- preuzimanje datoteka ---------- */
  var dl = {
    save: function (o) {
      var blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = o.filename;
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return Promise.resolve();
    }
  };
  var user = { isOwner: function () { return Promise.resolve(role === "owner"); } };

  window.claude = {
    use: function (n) {
      return ready.then(function () { return n === "db" ? db : n === "user" ? user : n === "downloads" ? dl : null; });
    }
  };

  /* ---------- postavke: sigurnosna kopija, uvoz, odjava ---------- */
  var setDone = false;
  function setupSettings() {
    if (setDone) return; var box = document.getElementById("setp"); if (!box) return; setDone = true;
    var w = document.createElement("div"); w.style.cssText = "margin-top:14px;border-top:1px solid var(--bd);padding-top:12px";
    w.innerHTML = '<div class="mu" style="margin-bottom:8px">Prijavljen: <b>' + (role === "owner" ? "vlasnik" : "zamjenik") + '</b></div>' +
      (role === "owner" ? '<div class="row" style="flex-wrap:wrap;margin-bottom:8px"><button class="b g" id="dpsbk">Sigurnosna kopija (JSON)</button><button class="b g" id="dpsim">Uvezi podatke…</button></div><input type="file" id="dpsfile" accept=".json,application/json" class="hide">' : "") +
      '<button class="b g" id="dpslo">Odjava</button>';
    box.appendChild(w);
    function msg(t) { if (window.say) window.say(t); else alert(t); }
    document.getElementById("dpslo").onclick = function () { dropToken(); location.reload(); };
    if (role === "owner") {
      document.getElementById("dpsbk").onclick = function () {
        api({ op: "export" }).then(function (j) { return dl.save({ filename: "dps-oprema-kopija-" + new Date().toISOString().slice(0, 10) + ".json", data: new Blob([JSON.stringify(j.export)], { type: "application/json" }) }); }).catch(function () { msg("Kopija nije uspjela."); });
      };
      var f = document.getElementById("dpsfile");
      document.getElementById("dpsim").onclick = function () { f.click(); };
      f.onchange = function () {
        var file = f.files[0]; if (!file) return;
        var rd = new FileReader();
        rd.onload = function () {
          try {
            var d = JSON.parse(rd.result);
            api({ op: "import", data: d }).then(function (j) { msg("Uvezeno zapisa: " + j.n + "."); poll(true); }).catch(function () { msg("Uvoz nije uspio."); });
          } catch (e) { msg("Datoteka nije ispravna."); }
          f.value = "";
        };
        rd.readAsText(file);
      };
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
