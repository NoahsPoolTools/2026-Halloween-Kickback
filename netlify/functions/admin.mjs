import { party, json, isAdmin, getEntrants, getStatus, tally, publicEntrant, photoKey, CATEGORY_IDS } from "../lib/common.mjs";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

async function deletePrefix(store, prefix) {
  const { blobs } = await store.list({ prefix });
  await Promise.all(blobs.map((b) => store.delete(b.key)));
  return blobs.length;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!isAdmin(req)) return json({ error: "Wrong PIN." }, 401);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request." }, 400);
  }
  const store = party();
  const { action } = body || {};

  switch (action) {
    case "check":
      return json({ ok: true });

    case "add": {
      const name = String(body.name || "").trim().slice(0, 60);
      const cats = [...new Set(Array.isArray(body.categories) ? body.categories : [body.category])];
      if (!name) return json({ error: "Type a name first." }, 400);
      if (!cats.length || !cats.every((c) => CATEGORY_IDS.includes(c)))
        return json({ error: "Pick at least one category." }, 400);

      const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);
      const photoId = newId();
      let hasPhoto = false;
      if (body.photo) {
        const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(body.photo);
        if (!m) return json({ error: "That photo format isn't supported." }, 400);
        const bytes = Buffer.from(m[2], "base64");
        if (bytes.length > MAX_PHOTO_BYTES) return json({ error: "Photo is too big. Try another." }, 400);
        await store.set(`photos/${photoId}`, new Blob([bytes], { type: m[1] }), { metadata: { contentType: m[1] } });
        hasPhoto = true;
      }
      const entrants = await getEntrants(store);
      const now = Date.now();
      const added = cats.map((category) => ({ id: newId(), name, category, hasPhoto, photoId, createdAt: now }));
      entrants.push(...added);
      await store.setJSON("entrants", entrants);
      return json({ ok: true, entrants: added.map(publicEntrant) });
    }

    case "rename": {
      const name = String(body.name || "").trim().slice(0, 60);
      if (!name) return json({ error: "Type a name first." }, 400);
      const entrants = await getEntrants(store);
      const e = entrants.find((x) => x.id === body.id);
      if (!e) return json({ error: "That entrant is gone." }, 404);
      e.name = name;
      await store.setJSON("entrants", entrants);
      return json({ ok: true });
    }

    case "remove": {
      const entrants = await getEntrants(store);
      const gone = entrants.find((x) => x.id === body.id);
      const next = entrants.filter((x) => x.id !== body.id);
      await store.setJSON("entrants", next);
      // only delete the photo if no other ballot entry still uses it
      if (gone?.hasPhoto && !next.some((x) => x.hasPhoto && photoKey(x) === photoKey(gone)))
        await store.delete(`photos/${photoKey(gone)}`);
      return json({ ok: true });
    }

    case "setStatus": {
      if (!CATEGORY_IDS.includes(body.category)) return json({ error: "Unknown category." }, 400);
      const status = await getStatus(store);
      status[body.category] = body.status === "closed" ? "closed" : "open";
      await store.setJSON("status", status);
      return json({ ok: true, status });
    }

    case "setAnswer": {
      const ids = [...new Set(Array.isArray(body.ids) ? body.ids : [])];
      const entrants = await getEntrants(store);
      const suspects = new Set(entrants.filter((e) => e.category === "murder").map((e) => e.id));
      if (ids.length > 10 || !ids.every((id) => suspects.has(id)))
        return json({ error: "Pick the murderers from the suspect list." }, 400);
      await store.setJSON("answer", { murderers: ids });
      return json({ ok: true });
    }

    case "results": {
      const [results, status] = await Promise.all([tally(store), getStatus(store)]);
      return json({ ok: true, results, status });
    }

    case "resetVotes": {
      let removed = 0;
      for (const cat of CATEGORY_IDS) removed += await deletePrefix(store, `votes/${cat}/`);
      return json({ ok: true, removed });
    }

    case "resetAll": {
      await deletePrefix(store, "votes/");
      await deletePrefix(store, "photos/");
      await store.delete("entrants");
      await store.delete("status");
      await store.delete("answer");
      return json({ ok: true });
    }

    default:
      return json({ error: "Unknown action." }, 400);
  }
};

export const config = { path: "/api/admin" };
