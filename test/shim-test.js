/* TESTNA zamjena za public/shim.js: ista sučelja (claude.use db/user/downloads),
   ali baza je lažna i živi samo u ovom pregledniku. Ne dira pravu aplikaciju. */
(function () {
  var KEY = "dpsTestDb-v2", COLS = ["items","lead","log","plans","svclog","config","stock","stockcnt","spare","fin"];
  var data = null, subs = {};
  function load() {
    try { var s = localStorage.getItem(KEY); if (s) { data = JSON.parse(s); return; } } catch (e) {}
    data = window.DPS_SEED ? JSON.parse(JSON.stringify(window.DPS_SEED)) : seed();
    COLS.forEach(function (c) { data[c] = data[c] || {}; });
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  function today(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return d.toISOString().slice(0, 10); }
  function seed() {
    var d = {}; COLS.forEach(function (c) { d[c] = {}; });
    function add(prefix, type, n, sizes, extra) {
      for (var i = 1; i <= n; i++) {
        var id = prefix + (i < 10 ? "0" + i : i), o = { type: type, status: "in", size: sizes ? sizes[(i - 1) % sizes.length] : "", dives: (i * 7) % 60, lastSvc: today(-30 * i) };
        if (extra) Object.assign(o, extra(i)); d.items[id] = o;
      }
    }
    add("RE", "RE", 6, null); add("KP", "BCD", 6, ["S","M","L","XL","M","L"]);
    add("ODI", "ODI", 12, ["S","M","M","L","L","L","XL","XL","M","L","S","XXL"]);
    add("CIZ", "CIZ", 10, ["38","39","40","41","42","43","43","44","45","46"]);
    add("MAS", "MAS", 8, null); add("PER", "PER", 8, ["S/M","M/L","L/XL"]);
    d.items.ODI03.rem = "poderana koljena"; d.items.RE02.rem = "bez zaštitnog čepa";
    d.plans.p1 = { trip: "Tečaj OWD (test)", people: [
      { name: "Ivo Horvat", v: { RE: "x", BCD: "L", ODI: "L", CIZ: "43", MAS: "x", PER: "L/XL" } },
      { name: "Ana Kovač", v: { RE: "x", BCD: "S", ODI: "S", CIZ: "38", MAS: "x", PER: "S/M" } },
      { name: "Marko Perić", v: { RE: "x", BCD: "M", ODI: "M", CIZ: "42", MAS: "x", PER: "M/L" } } ] };
    return d;
  }
  load();
  function snap(col, s) {
    var c = data[col] || {};
    if (s.id) { var v = c[s.id]; return { exists: v !== undefined, id: s.id, data: function () { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); } }; }
    return { docs: Object.keys(c).map(function (id) { var v = c[id]; return { id: id, data: function () { return JSON.parse(JSON.stringify(v)); } }; }) };
  }
  function fire(col) { (subs[col] || []).forEach(function (s) { try { s.cb(snap(col, s)); } catch (e) { console.error(e); } }); }
  function clean(o) { return JSON.parse(JSON.stringify(o == null ? {} : o)); }
  function write(col, op, id, d, merge) {
    return Promise.resolve().then(function () {
      if (COLS.indexOf(col) < 0) throw Object.assign(new Error("col"), { code: "col" });
      data[col] = data[col] || {};
      if (op === "add") id = Date.now().toString(36) + Math.random().toString(16).slice(2, 10);
      if (op === "delete") delete data[col][id];
      else if (op === "update") { if (!data[col][id]) throw Object.assign(new Error("Dokument ne postoji."), { code: "Dokument ne postoji." }); Object.assign(data[col][id], clean(d)); }
      else if (op === "set" && merge) data[col][id] = Object.assign({}, data[col][id] || {}, clean(d));
      else data[col][id] = clean(d);
      save(); fire(col); return { id: id };
    });
  }
  function sub(col, id, cb, err) {
    var s = { cb: cb, err: err, id: id }; (subs[col] = subs[col] || []).push(s);
    setTimeout(function () { cb(snap(col, s)); }, 0);
    return function () { subs[col] = subs[col].filter(function (x) { return x !== s; }); };
  }
  function docRef(col, id) {
    return { set: function (d, o) { return write(col, "set", id, d, o && o.merge); }, update: function (d) { return write(col, "update", id, d); }, delete: function () { return write(col, "delete", id); }, onSnapshot: function (cb, err) { return sub(col, id, cb, err); } };
  }
  var db = {
    collection: function (col) { return { doc: function (id) { return docRef(col, id); }, add: function (d) { return write(col, "add", null, d); }, onSnapshot: function (cb, err) { return sub(col, null, cb, err); } }; },
    doc: function (p) { var a = p.split("/"); return docRef(a[0], a[1]); }
  };
  var dl = { save: function (o) {
    var blob = o.data instanceof Blob ? o.data : new Blob([o.data], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = o.filename; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    return Promise.resolve();
  } };
  var user = { isOwner: function () { return Promise.resolve(true); } };
  window.dpsApi = ({ use: function (n) { return Promise.resolve(n === "db" ? db : n === "user" ? user : n === "downloads" ? dl : null); } });

  /* oznaka TESTNA VERZIJA + resetiranje podataka */
  function banner() {
    var b = document.createElement("div");
    b.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:200;background:#b86a00;color:#fff;font:600 12px system-ui;padding:3px 8px;text-align:center;padding-top:calc(3px + env(safe-area-inset-top,0px))";
    b.innerHTML = 'TESTNA VERZIJA – lažni podaci, pravu aplikaciju ne dira · <a href="#" id="dpsReset" style="color:#fff">poništi testne podatke</a>';
    document.body.appendChild(b); document.body.style.paddingTop = "26px";
    document.getElementById("dpsReset").onclick = function (e) { e.preventDefault(); try { localStorage.removeItem(KEY); } catch (x) {} location.reload(); };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", banner); else banner();
  /* postavke ⚙️ (u pravoj shimi dodaje sigurnosnu kopiju) – ovdje nepotrebno */
})();
