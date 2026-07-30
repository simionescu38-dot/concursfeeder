const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-write-key",
};
function json(o, s = 200) {
  return new Response(JSON.stringify(o), {
    status: s,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// ---------- calcul lider (oglindește leaderId() din index.html) ----------
function numOf(v) {
  if (v === null || v === undefined) return 0;
  v = ("" + v).trim().replace(",", ".");
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
function mOf(p, mi) {
  if (p && p.m && p.m[mi]) return p.m[mi];
  return { catches: [], extras: [], cmmc: "" };
}
function totalOfP(p, mi) {
  const m = mOf(p, mi);
  let s = 0;
  (m.catches || []).forEach((v) => (s += numOf(v)));
  (m.extras || []).forEach((v) => (s += numOf(v)));
  s += numOf(m.cmmc);
  return s;
}
function nameOfP(p) {
  return ((p.prenume || "") + " " + (p.nume || "")).trim() || "—";
}
function computeLeader(data) {
  if (!data || !Array.isArray(data.participants) || !data.participants.length) return null;
  const mi = data.manche || 1;
  let best = null, bt = 0;
  data.participants.forEach((p) => {
    const t = totalOfP(p, mi);
    if (t > bt + 1e-9) { bt = t; best = p; }
  });
  return best ? { id: best.id, name: nameOfP(best), kg: bt } : null;
}

// ---------- utilitare binare / base64url ----------
function b64urlToBytes(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}
function bytesToB64url(bytes) {
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concatBytes(...arrs) {
  let total = 0;
  arrs.forEach((a) => (total += a.length));
  const out = new Uint8Array(total);
  let off = 0;
  arrs.forEach((a) => { out.set(a, off); off += a.length; });
  return out;
}

// ---------- Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) ----------
async function hmacSha256(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, dataBytes);
  return new Uint8Array(sig);
}
async function buildVapidHeader(env, endpointUrl) {
  const url = new URL(endpointUrl);
  const aud = url.protocol + "//" + url.host;
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const claims = { aud, exp: now + 12 * 3600, sub: "mailto:simionescu38@gmail.com" };
  const enc = new TextEncoder();
  const encHeader = bytesToB64url(enc.encode(JSON.stringify(header)));
  const encClaims = bytesToB64url(enc.encode(JSON.stringify(claims)));
  const unsigned = encHeader + "." + encClaims;
  const privJwk = JSON.parse(env.VAPID_PRIVATE_JWK);
  const privKey = await crypto.subtle.importKey("jwk", privJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privKey, enc.encode(unsigned));
  const jwt = unsigned + "." + bytesToB64url(new Uint8Array(sig));
  return "vapid t=" + jwt + ", k=" + env.VAPID_PUBLIC_KEY;
}
async function encryptPayload(payloadBytes, p256dhB64, authB64) {
  const uaPublicRaw = b64urlToBytes(p256dhB64);
  const authSecret = b64urlToBytes(authB64);

  const asKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", asKeyPair.publicKey));

  const uaPublicKey = await crypto.subtle.importKey("raw", uaPublicRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublicKey }, asKeyPair.privateKey, 256));

  const prk = await hmacSha256(authSecret, ecdhSecret);

  const enc = new TextEncoder();
  const keyInfo = concatBytes(enc.encode("WebPush: info\0"), uaPublicRaw, asPublicRaw);
  const ikm = (await hmacSha256(prk, concatBytes(keyInfo, new Uint8Array([1])))).slice(0, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk2 = await hmacSha256(salt, ikm);

  const cekInfo = concatBytes(enc.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1]));
  const cek = (await hmacSha256(prk2, cekInfo)).slice(0, 16);

  const nonceInfo = concatBytes(enc.encode("Content-Encoding: nonce\0"), new Uint8Array([1]));
  const nonce = (await hmacSha256(prk2, nonceInfo)).slice(0, 12);

  const padded = concatBytes(payloadBytes, new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded));

  const rsBytes = new Uint8Array(4);
  new DataView(rsBytes.buffer).setUint32(0, 4096, false);
  const idlen = new Uint8Array([asPublicRaw.length]);
  const header = concatBytes(salt, rsBytes, idlen, asPublicRaw);

  return concatBytes(header, ciphertext);
}
async function sendWebPush(env, sub, payloadObj) {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payloadObj));
  const body = await encryptPayload(payloadBytes, sub.p256dh, sub.auth);
  const authHeader = await buildVapidHeader(env, sub.endpoint);
  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Authorization: authHeader,
    },
    body,
  });
  return res.status;
}
async function notifyRoomNewLeader(env, room, leaderName, leaderKg) {
  const subs = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM push_subs WHERE room=?").bind(room).all();
  const list = subs.results || [];
  const kgTxt = (Math.round(leaderKg * 1000) / 1000).toString().replace(".", ",");
  const payload = { title: "🏆 Nou lider!", body: leaderName + " — " + kgTxt + " kg" };
  await Promise.all(
    list.map(async (s) => {
      try {
        const status = await sendWebPush(env, s, payload);
        if (status === 404 || status === 410) {
          await env.DB.prepare("DELETE FROM push_subs WHERE endpoint=?").bind(s.endpoint).run();
        }
      } catch (e) { /* best-effort, ignoră eșecurile individuale */ }
    })
  );
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (url.pathname === "/api/state") {
      const room = (url.searchParams.get("room") || "").trim().toLowerCase();
      if (!room) return json({ ok: false, error: "missing room" }, 400);

      if (req.method === "GET") {
        const row = await env.DB.prepare("SELECT data, rev, name FROM rooms WHERE code=?").bind(room).first();
        if (!row) return json({ ok: true, rev: 0, data: null, name: null });
        return json({ ok: true, rev: row.rev, data: JSON.parse(row.data), name: row.name });
      }

      if (req.method === "PUT") {
        if ((req.headers.get("x-write-key") || "") !== env.WRITE_KEY)
          return json({ ok: false, error: "forbidden" }, 403);
        let body;
        try { body = await req.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
        const data = body && body.data;
        if (!data || typeof data !== "object") return json({ ok: false, error: "no data" }, 400);
        const name = (data.name || "").toString().slice(0, 200);
        const now = new Date().toISOString();

        const prevRow = await env.DB.prepare("SELECT data FROM rooms WHERE code=?").bind(room).first();
        const prevLeader = prevRow ? computeLeader(JSON.parse(prevRow.data)) : null;

        await env.DB.prepare(
          "INSERT INTO rooms (code,name,data,rev,updated_at) VALUES (?,?,?,1,?) " +
          "ON CONFLICT(code) DO UPDATE SET data=excluded.data, name=excluded.name, rev=rooms.rev+1, updated_at=excluded.updated_at"
        ).bind(room, name, JSON.stringify(data), now).run();
        const row = await env.DB.prepare("SELECT rev FROM rooms WHERE code=?").bind(room).first();

        const newLeader = computeLeader(data);
        if (newLeader && (!prevLeader || prevLeader.id !== newLeader.id) && env.VAPID_PRIVATE_JWK) {
          ctx.waitUntil(notifyRoomNewLeader(env, room, newLeader.name, newLeader.kg));
        }

        return json({ ok: true, rev: row.rev });
      }
      return json({ ok: false, error: "method" }, 405);
    }

    if (url.pathname === "/api/rooms" && req.method === "GET") {
      const rs = await env.DB.prepare("SELECT code,name,rev,updated_at FROM rooms ORDER BY updated_at DESC LIMIT 100").all();
      return json({ ok: true, rooms: rs.results || [] });
    }

    if (url.pathname === "/api/subscribe" && req.method === "POST") {
      const room = (url.searchParams.get("room") || "").trim().toLowerCase();
      if (!room) return json({ ok: false, error: "missing room" }, 400);
      let body;
      try { body = await req.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
      const sub = body && body.subscription;
      if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth)
        return json({ ok: false, error: "bad subscription" }, 400);
      const now = new Date().toISOString();
      await env.DB.prepare(
        "INSERT INTO push_subs (endpoint,room,p256dh,auth,created_at) VALUES (?,?,?,?,?) " +
        "ON CONFLICT(endpoint) DO UPDATE SET room=excluded.room, p256dh=excluded.p256dh, auth=excluded.auth"
      ).bind(sub.endpoint, room, sub.keys.p256dh, sub.keys.auth, now).run();
      return json({ ok: true });
    }

    if (url.pathname === "/api/unsubscribe" && req.method === "POST") {
      let body;
      try { body = await req.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
      const endpoint = body && body.endpoint;
      if (!endpoint) return json({ ok: false, error: "missing endpoint" }, 400);
      await env.DB.prepare("DELETE FROM push_subs WHERE endpoint=?").bind(endpoint).run();
      return json({ ok: true });
    }

    return json({ ok: false, error: "not found" }, 404);
  },
};
