import { party, json, getEntrants, getStatus, catById } from "../lib/common.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "That vote didn't come through. Try again." }, 400);
  }
  const { voterId, category, picks } = body || {};
  const cat = catById(category);

  if (typeof voterId !== "string" || !/^[a-zA-Z0-9-]{8,64}$/.test(voterId))
    return json({ error: "Your phone's voter ID is missing. Reload the page and try again." }, 400);
  if (!cat) return json({ error: "Unknown category." }, 400);
  const name = String(body.name || "").trim().slice(0, 40);
  if (cat.kind === "guess" && !name) return json({ error: "Type your name so Noah knows who guessed right." }, 400);

  const store = party();
  const [entrants, status] = await Promise.all([getEntrants(store), getStatus(store)]);
  if (status[category] !== "open")
    return json({ error: cat.kind === "guess" ? "Guessing isn't open right now." : "Voting is closed for this category." }, 409);

  const inCat = new Set(entrants.filter((e) => e.category === category).map((e) => e.id));
  const needed = Math.min(cat.pick, inCat.size);
  if (needed === 0) return json({ error: "No one is in this category yet." }, 409);

  if (!Array.isArray(picks) || picks.length !== needed)
    return json({ error: `Pick ${needed} different people.` }, 400);
  if (new Set(picks).size !== picks.length) return json({ error: "Each pick has to be a different person." }, 400);
  if (!picks.every((id) => inCat.has(id)))
    return json({ error: "Someone you picked was removed. Reload and pick again." }, 409);

  await store.setJSON(`votes/${category}/${voterId}`, cat.kind === "guess" ? { picks, name, at: Date.now() } : { picks, at: Date.now() });
  return json({ ok: true });
};

export const config = { path: "/api/vote" };
