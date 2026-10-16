import { getStore } from "@netlify/blobs";
import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";

const COLS = ["items", "lead", "log", "plans", "svclog", "config", "stock", "stockcnt"];
const DEPUTY_NO_WRITE = ["config", "svclog", "stock", "stockcnt"]; // zamjenik ne smije pisati
const DAYS = 120;

function envp(k) {
  let v; try { v = Netlify.env.get(k); } catch (e) {}
  if (!v) v = process.env[k];
  return v ? String(v).trim() : "";
}
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

const data = () => getStore({ name: "dps-data", consistency: "strong" });
const ver = () => getStore({ name: "dps-ver", consistency: "strong" });
const meta = () => getStore({ name: "dps-meta", consistency: "strong" });

async function secret() {
  const env = envp("TOKEN_SECRET");
  if (env) return env;
  const m = meta();
  let s = await m.get("secret");
  if (!s) { s = randomBytes(32).toString("hex"); await m.set("secret", s, { onlyIfNew: true }); s = await m.get("secret"); }
  return s;
}
const sign = (s, p) => createHmac("sha256", s).update(p).digest("hex");
async function makeToken(role) {
  const exp = Date.now() + DAYS * 864e5, p = role + "." + exp;
  return p + "." + sign(await secret(), p);
}
async function readToken(h) {
  const t = (h || "").replace(/^Bearer\s+/i, "");
  const [role, exp, sig] = t.split(".");
  if (!role || !exp || !sig || !["owner", "deputy"].includes(role) || Number(exp) < Date.now()) return null;
  const good = sign(await secret(), role + "." + exp);
  const a = Buffer.from(sig), b = Buffer.from(good);
  return a.length === b.length && timingSafeEqual(a, b) ? role : null;
}
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

async function login(pin, ip) {
  const m = meta(), key = "fail-" + String(ip || "x").replace(/[^0-9a-f:.]/gi, "");
  const f = (await m.get(key, { type: "json" })) || { n: 0, t: Date.now() };
  if (Date.now() - f.t > 15 * 60e3) { f.n = 0; f.t = Date.now(); }
  if (f.n >= 8) return { status: 429, body: { error: "Previše pokušaja. Pričekaj 15 minuta." } };
  const own = envp("OWNER_PIN"), dep = envp("DEPUTY_PIN");
  let role = null;
  if (own && same(pin, own)) role = "owner"; else if (dep && same(pin, dep)) role = "deputy";
  if (!role) {
    f.n++; await m.setJSON(key, f);
    await new Promise(r => setTimeout(r, 500));
    return { status: 401, body: { error: "Pogrešan PIN." } };
  }
  if (f.n) await m.delete(key);
  return { status: 200, body: { role, token: await makeToken(role) } };
}

const okCol = c => COLS.includes(c);
const okId = id => typeof id === "string" && /^[A-Za-z0-9_\-]{1,80}$/.test(id);
const bump = col => ver().set(col, String(Date.now()) + Math.random());

async function listCol(col) {
  const s = data();
  const { blobs } = await s.list({ prefix: col + "/" });
  const out = [];
  for (let i = 0; i < blobs.length; i += 25) {
    const part = await Promise.all(blobs.slice(i, i + 25).map(async b => {
      const d = await s.get(b.key, { type: "json" });
      return d == null ? null : { id: b.key.slice(col.length + 1), data: d };
    }));
    out.push(...part.filter(Boolean));
  }
  return out;
}
const clean = o => JSON.parse(JSON.stringify(o ?? {}));

export default async (req, context) => {
  if (req.method === "GET") return json({ app: "dps-oprema", ownerPin: !!envp("OWNER_PIN"), deputyPin: !!envp("DEPUTY_PIN") });
  if (req.method !== "POST") return json({ error: "POST" }, 405);
  let b; try { b = await req.json(); } catch { return json({ error: "Neispravan zahtjev." }, 400); }
  if (b.op === "login") { const r = await login(String(b.pin || "").trim(), context.ip); return json(r.body, r.status); }

  const role = await readToken(req.headers.get("authorization"));
  if (!role) return json({ error: "auth" }, 401);
  const s = data();

  try {
    if (b.op === "ver") {
      const { blobs } = await ver().list();
      const v = {}; blobs.forEach(x => (v[x.key] = x.etag)); return json({ v, role });
    }
    if (b.op === "list") { if (!okCol(b.col)) return json({ error: "col" }, 400); return json({ docs: await listCol(b.col) }); }

    if (["set", "update", "delete", "add"].includes(b.op)) {
      if (!okCol(b.col)) return json({ error: "col" }, 400);
      if (role === "deputy" && (DEPUTY_NO_WRITE.includes(b.col) || b.op === "delete" || (b.op === "set" && b.col === "items")))
        return json({ error: "Nemaš dopuštenje za ovu radnju." }, 403);
      let id = b.id;
      if (b.op === "add") id = Date.now().toString(36) + randomBytes(4).toString("hex");
      if (!okId(id)) return json({ error: "id" }, 400);
      const key = b.col + "/" + id;
      if (b.op === "delete") await s.delete(key);
      else if (b.op === "update") {
        const cur = await s.get(key, { type: "json" });
        if (cur == null) return json({ error: "Dokument ne postoji." }, 404);
        await s.setJSON(key, Object.assign({}, cur, clean(b.data)));
      } else if (b.op === "set" && b.merge) {
        const cur = (await s.get(key, { type: "json" })) || {};
        await s.setJSON(key, Object.assign({}, cur, clean(b.data)));
      } else await s.setJSON(key, clean(b.data));
      await bump(b.col);
      return json({ ok: true, id });
    }

    if (role !== "owner") return json({ error: "Samo za vlasnika." }, 403);

    if (b.op === "export") {
      const out = {}; for (const c of COLS) { out[c] = {}; (await listCol(c)).forEach(d => (out[c][d.id] = d.data)); }
      return json({ export: out });
    }
    if (b.op === "import") {
      let n = 0;
      for (const c of COLS) {
        const col = (b.data || {})[c]; if (!col) continue;
        for (const [id, d] of Object.entries(col)) { if (!okId(id)) continue; await s.setJSON(c + "/" + id, clean(d)); n++; }
        await bump(c);
      }
      return json({ ok: true, n });
    }
    return json({ error: "op" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: "Greška na serveru." }, 500);
  }
};
export const config = { path: "/api" };
