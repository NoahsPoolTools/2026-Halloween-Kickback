import { getStore } from "@netlify/blobs";

export const PARTY_TITLE = "Noah's 2026 Halloween Party Kickback";

export const CATEGORIES = [
  { id: "best", name: "Best Costume", emoji: "🎃" },
  { id: "couple", name: "Best Couples Costume", emoji: "💀" },
  { id: "worst", name: "Worst Costume", emoji: "🤡" },
];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);
export const POINTS = [3, 2, 1];

export const party = () => getStore({ name: "halloween-2026", consistency: "strong" });

export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const adminPin = () => (process.env.ADMIN_PIN || "1031").trim();
export const isAdmin = (req) => (req.headers.get("x-admin-pin") || "").trim() === adminPin();

export async function getEntrants(store) {
  return (await store.get("entrants", { type: "json" })) || [];
}

export async function getStatus(store) {
  const saved = (await store.get("status", { type: "json" })) || {};
  const status = {};
  for (const id of CATEGORY_IDS) status[id] = saved[id] === "closed" ? "closed" : "open";
  return status;
}

export const photoUrl = (e) => (e.hasPhoto ? `/api/photo/${e.id}?v=${e.createdAt}` : null);

export const publicEntrant = (e) => ({
  id: e.id,
  name: e.name,
  category: e.category,
  photo: photoUrl(e),
});

export async function tally(store) {
  const entrants = await getEntrants(store);
  const results = {};

  for (const cat of CATEGORY_IDS) {
    const rows = new Map();
    for (const e of entrants.filter((x) => x.category === cat)) {
      rows.set(e.id, { ...publicEntrant(e), points: 0, firsts: 0, seconds: 0, thirds: 0 });
    }
    const { blobs } = await store.list({ prefix: `votes/${cat}/` });
    const votes = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    let voters = 0;
    for (const v of votes) {
      if (!v || !Array.isArray(v.picks)) continue;
      voters++;
      v.picks.slice(0, 3).forEach((id, i) => {
        const row = rows.get(id);
        if (!row) return; // entrant was removed
        row.points += POINTS[i];
        if (i === 0) row.firsts++;
        if (i === 1) row.seconds++;
        if (i === 2) row.thirds++;
      });
    }
    const ranking = [...rows.values()].sort(
      (a, b) =>
        b.points - a.points || b.firsts - a.firsts || b.seconds - a.seconds || a.name.localeCompare(b.name)
    );
    results[cat] = { voters, ranking };
  }
  return results;
}
