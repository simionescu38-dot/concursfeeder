const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-write-key",
};
function json(o, s = 200) {
  return new Response(JSON.stringify(o), {
    status: s,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}
export default {
  async fetch(req, env) {
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
        await env.DB.prepare(
          "INSERT INTO rooms (code,name,data,rev,updated_at) VALUES (?,?,?,1,?) " +
          "ON CONFLICT(code) DO UPDATE SET data=excluded.data, name=excluded.name, rev=rooms.rev+1, updated_at=excluded.updated_at"
        ).bind(room, name, JSON.stringify(data), now).run();
        const row = await env.DB.prepare("SELECT rev FROM rooms WHERE code=?").bind(room).first();
        return json({ ok: true, rev: row.rev });
      }
      return json({ ok: false, error: "method" }, 405);
    }

    if (url.pathname === "/api/rooms" && req.method === "GET") {
      const rs = await env.DB.prepare("SELECT code,name,rev,updated_at FROM rooms ORDER BY updated_at DESC LIMIT 100").all();
      return json({ ok: true, rooms: rs.results || [] });
    }
    return json({ ok: false, error: "not found" }, 404);
  },
};
