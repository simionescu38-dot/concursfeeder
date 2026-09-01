const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-write-key, x-manage-token",
  // Ora concursului e a serverului, nu a telefonului: fără linia asta, browserul nu
  // poate citi antetul "Date" al răspunsului (nu e printre antetele expuse implicit),
  // iar fiecare telefon numără pe ceasul lui.
  "Access-Control-Expose-Headers": "Date",
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

// ---------- citirea afișajului de cântar ----------
/* Modelele nu întorc toate la fel: unele dau {response}, altele forma OpenAI cu
   {choices:[{message:{content}}]}. Se caută textul oriunde ar sta, ca schimbarea modelului
   să nu ceară cod nou. */
function textDinRaspuns(r) {
  if (!r) return "";
  if (typeof r === "string") return r;
  if (typeof r.response === "string") return r.response;
  if (r.choices && r.choices[0] && r.choices[0].message) {
    const c = r.choices[0].message.content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) return c.map((x) => (x && x.text) || "").join(" ");
  }
  if (r.result) {
    if (typeof r.result === "string") return r.result;
    if (typeof r.result.response === "string") return r.result.response;
  }
  return "";
}
/* Modelul mai pune vorbe în jurul JSON-ului, oricât l-ai ruga. Se caută acolada; dacă nici
   aia nu e, primul număr cu zecimale de pe rând. Ce nu se poate citi curat se întoarce ca
   NESIGUR — mai bine o căsuță goală decât o cifră inventată intrată în clasament. */
function kgDinText(text) {
  let kg = null, sigur = false;
  const acolada = text.match(/\{[\s\S]*\}/);
  if (acolada) {
    try {
      const o = JSON.parse(acolada[0]);
      kg = numOf(o.kg);
      sigur = o.sigur === true;
    } catch (e) {}
  }
  if (!(kg > 0)) {
    const n = text.match(/\d{1,3}[.,]\d{1,3}/);
    if (n) { kg = numOf(n[0]); sigur = false; }
  }
  // un juvelnic nu are 0 kg, iar cântarul lui nu trece de 50 — ce iese în afară nu e citire
  if (!(kg > 0) || kg > 50) return { kg: null, sigur: false };
  return { kg: Math.round(kg * 1000) / 1000, sigur };
}
/* Foaia de tragere: din răspunsul modelului iese o listă de perechi stand+nume. Ce nu arată
   a stand (1…999) sau a nume se aruncă aici, nu pe telefon: un rând stricat plecat de pe
   server ar ajunge în căsuța de text și ar părea citit de pe foaie. */
function randuriDinText(text) {
  let brut = null;
  const acolada = text.match(/\{[\s\S]*\}/);
  if (acolada) { try { brut = JSON.parse(acolada[0]).randuri; } catch (e) {} }
  if (!Array.isArray(brut)) {
    const paranteze = text.match(/\[[\s\S]*\]/);
    if (paranteze) { try { brut = JSON.parse(paranteze[0]); } catch (e) {} }
  }
  if (!Array.isArray(brut)) return [];
  const out = [], vazute = {};
  for (const x of brut) {
    if (!x || typeof x !== "object") continue;
    const stand = String(x.stand === undefined || x.stand === null ? "" : x.stand).trim();
    if (!/^\d{1,3}$/.test(stand) || Number(stand) < 1) continue;
    // numele: litere, spații și cratime; cifrele n-au ce căuta în el
    const nume = String(x.nume || "").replace(/[^\p{L}\s'-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
    if (nume.length < 2) continue;
    // un stand citit de două ori înseamnă că modelul a alunecat pe rânduri; rămâne primul
    if (vazute[stand]) continue;
    vazute[stand] = true;
    /* Sectorul e scris pe foaie, într-o coloană cu standul („A 2"), și NU se potrivește
       întotdeauna cu cel socotit din stand: pe foaia de la Rediu Galian A ține standurile
       2…7, fiindcă standul 1 nu se folosește. Un sector greșit schimbă punctele, deci se
       duce mai departe ce scrie pe hârtie. */
    const sector = String(x.sector || "").trim().toUpperCase().slice(0, 1);
    out.push(/^[A-Z]$/.test(sector) ? { stand, nume, sector } : { stand, nume });
    if (out.length >= 200) break;
  }
  return out;
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

// ---------- backup permanent în git (arhiva/*.json), independent de D1 ----------
const GH_OWNER = "simionescu38-dot";
const GH_REPO = "concursfeeder";
function slugify(s) {
  return (s || "")
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "concurs";
}
function ghHeaders(env) {
  return {
    Authorization: "Bearer " + env.GITHUB_TOKEN,
    "User-Agent": "concurs-api-worker",
    Accept: "application/vnd.github+json",
  };
}
async function ghGetFile(env, path) {
  const res = await fetch(
    "https://api.github.com/repos/" + GH_OWNER + "/" + GH_REPO + "/contents/" + path,
    { headers: ghHeaders(env) }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("github get failed: " + res.status);
  return res.json();
}
async function ghPutFile(env, path, contentObj, message) {
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(contentObj))));
  const res = await fetch(
    "https://api.github.com/repos/" + GH_OWNER + "/" + GH_REPO + "/contents/" + path,
    {
      method: "PUT",
      headers: ghHeaders(env),
      body: JSON.stringify({ message, content: b64, branch: "main" }),
    }
  );
  if (!res.ok) throw new Error("github put failed: " + res.status + " " + (await res.text()));
  return res.json();
}
async function ghDeleteFile(env, path, message) {
  const info = await ghGetFile(env, path);
  if (!info) return;
  const res = await fetch(
    "https://api.github.com/repos/" + GH_OWNER + "/" + GH_REPO + "/contents/" + path,
    {
      method: "DELETE",
      headers: ghHeaders(env),
      body: JSON.stringify({ message, sha: info.sha, branch: "main" }),
    }
  );
  if (!res.ok) throw new Error("github delete failed: " + res.status);
}
async function ghUniquePath(env, basePath) {
  let path = basePath;
  for (let n = 2; n <= 20; n++) {
    if (!(await ghGetFile(env, path))) return path;
    path = basePath.replace(/\.json$/, "") + "-" + n + ".json";
  }
  return path;
}
// arhivează în arhiva/*.json — cel de-al doilea loc de stocare, în afara D1, care
// nu poate fi șters din greșeală din aplicație (vezi „Șterge TOATE arhivele" din Setări)
async function backupArchiveToGit(env, name, data, now) {
  if (!env.GITHUB_TOKEN) return null;
  const dateStr = now.slice(0, 10);
  const basePath = "arhiva/" + dateStr + "-" + slugify(name) + ".json";
  const path = await ghUniquePath(env, basePath);
  await ghPutFile(
    env,
    path,
    { app: "concurs-pescuit", ver: 1, exportedAt: now, data },
    "Arhivare automată: " + (name || "concurs fără nume")
  );
  return path;
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    /* Poza afișajului de cântar → cifra.
       Cifrele de pe cântar sunt singurul lucru din tot lanțul care nu se scoate cu cod
       scris de mână: bat reflexii, e apă pe geam, unghiul e strâmb. Se întreabă un model
       care se uită la imagine.
       Stă AICI, nu în telefon, din două motive: cheia n-are ce căuta pe un telefon care mai
       ajunge în mâna altcuiva, iar aplicația trebuie să rămână un singur fișier care merge
       fără internet. Când drumul ăsta nu răspunde — semnal prost, model căzut, binding
       nepus — telefonul lasă căsuța goală și omul scrie de mână, exact ca până acum. */
    if (url.pathname === "/api/citeste-cantar" && req.method === "POST") {
      if ((req.headers.get("x-write-key") || "") !== env.WRITE_KEY)
        return json({ ok: false, error: "forbidden" }, 403);
      if (!env.AI) return json({ ok: false, error: "fara-ai" }, 501);

      let body;
      try { body = await req.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
      const poza = (body && body.poza) || "";
      if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(poza))
        return json({ ok: false, error: "fara poza" }, 400);
      // telefonul micșorează poza înainte s-o trimită; peste atât e o greșeală, nu o foaie
      if (poza.length > 1400000) return json({ ok: false, error: "poza prea mare" }, 413);

      const INTREBARE =
        "În poză e afișajul unui cântar de mână (Eastshark, maxim 50 kg), cu cifre din " +
        "bețișoare, negre pe fond gri. Spune-mi NUMAI numărul afișat pe ecran, în kilograme, " +
        "cu zecimale, folosind punct ca separator. Ignoră scrisul tipărit de pe carcasă: " +
        "\"50kg/110lb\", \"HOLD\", \"Kg\", \"UNIT\", \"TARE\", \"ON/OFF\", \"eastshark\". " +
        "Răspunde doar cu JSON, fără nimic în jurul lui: {\"kg\": 11.29, \"sigur\": true}. " +
        "Dacă nu poți citi cifrele cu siguranță, pune \"sigur\": false.";

      let raspuns;
      try {
        raspuns = await env.AI.run("@cf/qwen/qwen3.8-27b", {
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: poza } },
              { type: "text", text: INTREBARE },
            ],
          }],
          max_tokens: 120,
        });
      } catch (e) {
        return json({ ok: false, error: "citirea n-a mers" }, 502);
      }

      const text = textDinRaspuns(raspuns);
      const citit = kgDinText(text);
      // „brut" rămâne în răspuns ca să se poată vedea, la o citire greșită, ce a spus
      // modelul de fapt — altfel n-ai cum să deosebești un model prost de un cod prost
      return json({ ok: true, kg: citit.kg, sigur: citit.sigur, brut: text.slice(0, 200) });
    }

    /* Foaia de tragere la sorți, fotografiată și trimisă pe grup. Ce iese de aici NU intră
       în concurs: telefonul scrie lista în căsuța de text, ca omul s-o vadă și s-o dreagă
       înainte de „Verifică". Un stand citit greșit e mai rău decât unul netrecut. */
    if (url.pathname === "/api/citeste-tragerea" && req.method === "POST") {
      if ((req.headers.get("x-write-key") || "") !== env.WRITE_KEY)
        return json({ ok: false, error: "forbidden" }, 403);
      if (!env.AI) return json({ ok: false, error: "fara-ai" }, 501);

      let body;
      try { body = await req.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
      const poza = (body && body.poza) || "";
      if (!/^data:image\/(jpeg|jpg|png|webp);base64,/.test(poza))
        return json({ ok: false, error: "fara poza" }, 400);
      if (poza.length > 1400000) return json({ ok: false, error: "poza prea mare" }, 413);

      /* Întrebarea e scrisă după foaia adevărată, nu după una închipuită. Prima variantă
         cerea „un număr de stand și un nume" și pierdea o bandă din mijloc: foaia are
         sectorul și standul într-o coloană („A 2"), numele pe DOUĂ rânduri (prenumele
         deasupra, numele dedesubt) și, în dreapta, o grilă goală de cantități, lată cât
         jumătate de pagină. Grila aia e zgomotul care făcea citirea să-și piardă locul. */
      const INTREBARE =
        "În poză e foaia unui concurs de pescuit, un tabel cu rânduri. Structura fiecărui rând:\n" +
        "- prima coloană (SECTOR): o literă de sector (A, B, C sau D) urmată de numărul standului, " +
        "de exemplu \"A 2\", \"B 8\", \"C 14\";\n" +
        "- a doua coloană (NUME): numele pescarului, scris de mână cu majuscule, de obicei pe " +
        "DOUĂ rânduri — prenumele deasupra, numele de familie dedesubt. Lipește-le într-un " +
        "singur nume, în ordinea în care sunt scrise;\n" +
        "- restul foii, în dreapta (CANTITATE): o grilă de căsuțe, goală. IGNOR-O complet.\n" +
        "Ignoră și antetul: data, manșa, arbitrul, sigla, LOCUL 1/2/3, CMMC.\n" +
        "Citește rândurile de sus în jos, pe rând, fără să sari niciunul. Rândurile în care " +
        "coloana NUME e goală se sar — sunt locuri neocupate.\n" +
        "Numele sunt românești. Nu inventa nimic: dacă un nume nu se poate citi, sari rândul.\n" +
        "Răspunde doar cu JSON, fără nimic în jurul lui:\n" +
        "{\"randuri\": [{\"sector\": \"A\", \"stand\": \"2\", \"nume\": \"NICU ROMAN\"}, " +
        "{\"sector\": \"B\", \"stand\": \"8\", \"nume\": \"COSTEL TATIANA\"}]}";

      let raspuns;
      try {
        raspuns = await env.AI.run("@cf/qwen/qwen3.8-27b", {
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: poza } },
              { type: "text", text: INTREBARE },
            ],
          }],
          // o foaie de 50 de pescari are nevoie de loc; la cântar ajungeau 120
          max_tokens: 3000,
        });
      } catch (e) {
        return json({ ok: false, error: "citirea n-a mers" }, 502);
      }

      const text = textDinRaspuns(raspuns);
      const randuri = randuriDinText(text);
      if (!randuri.length) return json({ ok: false, error: "necitit", brut: text.slice(0, 300) });
      return json({ ok: true, randuri, brut: text.slice(0, 300) });
    }

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

        const prevRow = await env.DB.prepare("SELECT data, rev FROM rooms WHERE code=?").bind(room).first();
        const prevLeader = prevRow ? computeLeader(JSON.parse(prevRow.data)) : null;

        if (prevRow) {
          await env.DB.prepare(
            "INSERT INTO room_history (id,room,rev,data,saved_at) VALUES (?,?,?,?,?)"
          ).bind(crypto.randomUUID(), room, prevRow.rev, prevRow.data, now).run();
          // păstrează doar ultimele 40 de versiuni pe cameră, ca istoricul să nu crească nelimitat
          await env.DB.prepare(
            "DELETE FROM room_history WHERE room=? AND id NOT IN (" +
            "SELECT id FROM room_history WHERE room=? ORDER BY saved_at DESC LIMIT 40)"
          ).bind(room, room).run();
        }

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

    if (url.pathname === "/api/history" && req.method === "GET") {
      const room = (url.searchParams.get("room") || "").trim().toLowerCase();
      if (!room) return json({ ok: false, error: "missing room" }, 400);
      const rs = await env.DB.prepare(
        "SELECT id, rev, saved_at, data FROM room_history WHERE room=? ORDER BY saved_at DESC"
      ).bind(room).all();
      const versions = (rs.results || []).map((r) => {
        let name = "", count = 0;
        try {
          const d = JSON.parse(r.data);
          name = d.name || "";
          count = Array.isArray(d.participants) ? d.participants.length : 0;
        } catch (e) { /* ignoră rânduri corupte */ }
        return { id: r.id, rev: r.rev, saved_at: r.saved_at, name, participants: count };
      });
      return json({ ok: true, versions });
    }

    if (url.pathname === "/api/restore" && req.method === "POST") {
      if ((req.headers.get("x-write-key") || "") !== env.WRITE_KEY)
        return json({ ok: false, error: "forbidden" }, 403);
      const room = (url.searchParams.get("room") || "").trim().toLowerCase();
      const id = (url.searchParams.get("id") || "").trim();
      if (!room || !id) return json({ ok: false, error: "missing room or id" }, 400);
      const histRow = await env.DB.prepare("SELECT data FROM room_history WHERE id=? AND room=?").bind(id, room).first();
      if (!histRow) return json({ ok: false, error: "not found" }, 404);
      const now = new Date().toISOString();

      // salvează starea curentă înainte de restaurare, ca restaurarea însăși să fie reversibilă
      const curRow = await env.DB.prepare("SELECT data, rev FROM rooms WHERE code=?").bind(room).first();
      if (curRow) {
        await env.DB.prepare(
          "INSERT INTO room_history (id,room,rev,data,saved_at) VALUES (?,?,?,?,?)"
        ).bind(crypto.randomUUID(), room, curRow.rev, curRow.data, now).run();
      }

      const data = JSON.parse(histRow.data);
      const name = (data.name || "").toString().slice(0, 200);
      await env.DB.prepare(
        "INSERT INTO rooms (code,name,data,rev,updated_at) VALUES (?,?,?,1,?) " +
        "ON CONFLICT(code) DO UPDATE SET data=excluded.data, name=excluded.name, rev=rooms.rev+1, updated_at=excluded.updated_at"
      ).bind(room, name, histRow.data, now).run();
      const row = await env.DB.prepare("SELECT rev FROM rooms WHERE code=?").bind(room).first();
      return json({ ok: true, rev: row.rev });
    }

    if (url.pathname === "/api/rooms" && req.method === "GET") {
      const rs = await env.DB.prepare("SELECT code,name,rev,updated_at FROM rooms ORDER BY updated_at DESC LIMIT 100").all();
      return json({ ok: true, rooms: rs.results || [] });
    }

    if (url.pathname === "/api/archive") {
      if (req.method === "POST") {
        if ((req.headers.get("x-write-key") || "") !== env.WRITE_KEY)
          return json({ ok: false, error: "forbidden" }, 403);
        let body;
        try { body = await req.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
        const data = body && body.data;
        if (!data || typeof data !== "object") return json({ ok: false, error: "no data" }, 400);
        const room = (url.searchParams.get("room") || "").trim().toLowerCase();
        const name = (data.name || "").toString().slice(0, 200);
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare(
          "INSERT INTO season_archive (id,room,name,data,archived_at) VALUES (?,?,?,?,?)"
        ).bind(id, room, name, JSON.stringify(data), now).run();

        let gitPath = null;
        let gitBackupError = null;
        try {
          gitPath = await backupArchiveToGit(env, name, data, now);
          if (gitPath) {
            await env.DB.prepare("UPDATE season_archive SET git_path=? WHERE id=?").bind(gitPath, id).run();
          }
        } catch (e) { gitPath = null; gitBackupError = String(e && e.message || e); } // best-effort — arhiva rămâne validă în D1 chiar dacă backup-ul în git eșuează

        return json({ ok: true, id, gitBackup: !!gitPath, gitBackupError });
      }

      if (req.method === "GET") {
        const rs = await env.DB.prepare("SELECT id,room,name,data,archived_at FROM season_archive ORDER BY archived_at DESC LIMIT 300").all();
        const archives = (rs.results || []).map((r) => ({
          id: r.id, room: r.room, name: r.name, archived_at: r.archived_at, data: JSON.parse(r.data),
        }));
        return json({ ok: true, archives });
      }

      if (req.method === "DELETE") {
        if ((req.headers.get("x-write-key") || "") !== env.WRITE_KEY)
          return json({ ok: false, error: "forbidden" }, 403);
        const id = (url.searchParams.get("id") || "").trim();
        if (!id) return json({ ok: false, error: "missing id" }, 400);
        // "replace=1" e trimis DOAR de rearhivarea automată a aceluiași concurs (înlocuire
        // imediată de la același telefon) — atunci înlocuim și fișierul din git. Ștergerea
        // manuală din Setări NU trimite replace=1, ca fișierul din arhiva/ să rămână intact
        // chiar dacă arhiva e ștearsă din D1 din greșeală.
        if (url.searchParams.get("replace") === "1" && env.GITHUB_TOKEN) {
          const row = await env.DB.prepare("SELECT git_path FROM season_archive WHERE id=?").bind(id).first();
          if (row && row.git_path) {
            try { await ghDeleteFile(env, row.git_path, "Elimină arhivă înlocuită: " + row.git_path); } catch (e) { /* best-effort */ }
          }
        }
        await env.DB.prepare("DELETE FROM season_archive WHERE id=?").bind(id).run();
        return json({ ok: true });
      }

      return json({ ok: false, error: "method" }, 405);
    }

    if (url.pathname === "/api/events") {
      if (req.method === "GET") {
        /* Opt zile, nu una. `event_date` ține data de ÎNCEPUT, chiar și la concursurile de
           mai multe zile („2026-09-12/14"). Cu o singură zi de răgaz, unul de trei zile
           dispărea din calendar chiar în ultima lui zi, când lumea încă pescuia.
           Se poate lărgi fără grijă fiindcă aplicația taie ea concursurile terminate, după
           data lor de sfârșit — altfel unul vechi de o săptămână ar rămâne agățat acolo.
           Amândouă părțile sunt probate în test-calendar-doua-zile.js. */
        const cutoff = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const rs = await env.DB.prepare(
          "SELECT id,name,location,event_date,type,fee,slots_total,slots_taken,organizer,contact,created_at " +
          "FROM events WHERE event_date >= ? ORDER BY event_date ASC LIMIT 200"
        ).bind(cutoff).all();
        return json({ ok: true, events: rs.results || [] });
      }

      if (req.method === "POST") {
        let body;
        try { body = await req.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
        const name = ((body && body.name) || "").toString().trim().slice(0, 200);
        const location = ((body && body.location) || "").toString().trim().slice(0, 200);
        const eventDate = ((body && body.eventDate) || "").toString().trim().slice(0, 20);
        if (!name || !location || !eventDate) return json({ ok: false, error: "name, location și eventDate sunt obligatorii" }, 400);
        const type = ((body && body.type) || "").toString().trim().slice(0, 60);
        const fee = ((body && body.fee) || "").toString().trim().slice(0, 60);
        const slotsTotal = body && body.slotsTotal ? Math.max(0, parseInt(body.slotsTotal, 10) || 0) : null;
        const organizer = ((body && body.organizer) || "").toString().trim().slice(0, 120);
        const contact = ((body && body.contact) || "").toString().trim().slice(0, 120);

        const id = crypto.randomUUID();
        const manageToken = crypto.randomUUID().replace(/-/g, "");
        const now = new Date().toISOString();
        await env.DB.prepare(
          "INSERT INTO events (id,name,location,event_date,type,fee,slots_total,slots_taken,organizer,contact,manage_token,created_at) " +
          "VALUES (?,?,?,?,?,?,?,0,?,?,?,?)"
        ).bind(id, name, location, eventDate, type, fee, slotsTotal, organizer, contact, manageToken, now).run();

        return json({ ok: true, id, manageToken });
      }

      return json({ ok: false, error: "method" }, 405);
    }

    if (url.pathname === "/api/events/edit") {
      const id = (url.searchParams.get("id") || "").trim();
      if (!id) return json({ ok: false, error: "missing id" }, 400);
      const token = req.headers.get("x-manage-token") || "";
      const writeKey = req.headers.get("x-write-key") || "";
      const isAdmin = !!writeKey && writeKey === env.WRITE_KEY;
      const row = await env.DB.prepare("SELECT manage_token FROM events WHERE id=?").bind(id).first();
      if (!row) return json({ ok: false, error: "not found" }, 404);
      if (!isAdmin && (!token || token !== row.manage_token)) return json({ ok: false, error: "forbidden" }, 403);

      if (req.method === "PUT") {
        let body;
        try { body = await req.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
        const name = ((body && body.name) || "").toString().trim().slice(0, 200);
        const location = ((body && body.location) || "").toString().trim().slice(0, 200);
        const eventDate = ((body && body.eventDate) || "").toString().trim().slice(0, 20);
        if (!name || !location || !eventDate) return json({ ok: false, error: "name, location și eventDate sunt obligatorii" }, 400);
        const type = ((body && body.type) || "").toString().trim().slice(0, 60);
        const fee = ((body && body.fee) || "").toString().trim().slice(0, 60);
        const slotsTotal = body && body.slotsTotal ? Math.max(0, parseInt(body.slotsTotal, 10) || 0) : null;
        const slotsTaken = body && body.slotsTaken ? Math.max(0, parseInt(body.slotsTaken, 10) || 0) : 0;
        const organizer = ((body && body.organizer) || "").toString().trim().slice(0, 120);
        const contact = ((body && body.contact) || "").toString().trim().slice(0, 120);
        await env.DB.prepare(
          "UPDATE events SET name=?, location=?, event_date=?, type=?, fee=?, slots_total=?, slots_taken=?, organizer=?, contact=? WHERE id=?"
        ).bind(name, location, eventDate, type, fee, slotsTotal, slotsTaken, organizer, contact, id).run();
        return json({ ok: true });
      }

      if (req.method === "DELETE") {
        await env.DB.prepare("DELETE FROM events WHERE id=?").bind(id).run();
        return json({ ok: true });
      }

      return json({ ok: false, error: "method" }, 405);
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
