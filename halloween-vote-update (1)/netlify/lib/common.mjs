import { getStore } from "@netlify/blobs";

export const PARTY_TITLE = "Noah's 2026 Halloween Party Kickback";

// kind "rank": pick top 3 in order (3/2/1 points). kind "guess": pick N unranked, scored against the real answer.
export const CATEGORIES = [
  { id: "best", name: "Best Costume", emoji: "🎃", kind: "rank", pick: 3 },
  { id: "couple", name: "Best Couples Costume", emoji: "💀", kind: "rank", pick: 3 },
  { id: "worst", name: "Worst Costume", emoji: "🤡", kind: "rank", pick: 3 },
  { id: "murder", name: "Murder Mystery", emoji: "🔪", kind: "guess", pick: 5 },
];
export const catById = (id) => CATEGORIES.find((c) => c.id === id);
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
  // costume ballots start open; the murder mystery starts closed until the host opens it
  for (const c of CATEGORIES) status[c.id] = saved[c.id] || (c.kind === "guess" ? "closed" : "open");
  return status;
}

export const photoKey = (e) => e.photoId || e.id;
export const photoUrl = (e) => (e.hasPhoto ? `/api/photo/${photoKey(e)}?v=${e.createdAt}` : null);

export const publicEntrant = (e) => ({
  id: e.id,
  name: e.name,
  category: e.category,
  photo: photoUrl(e),
});

export async function getAnswer(store) {
  return ((await store.get("answer", { type: "json" })) || {}).murderers || [];
}

async function readVotes(store, cat) {
  const { blobs } = await store.list({ prefix: `votes/${cat}/` });
  const votes = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return votes.filter((v) => v && Array.isArray(v.picks));
}

export async function tally(store) {
  const [entrants, answerRaw] = await Promise.all([getEntrants(store), getAnswer(store)]);
  const results = {};

  for (const c of CATEGORIES) {
    const cat = c.id;
    const rows = new Map();
    for (const e of entrants.filter((x) => x.category === cat)) {
      rows.set(e.id, { ...publicEntrant(e), points: 0, firsts: 0, seconds: 0, thirds: 0, guesses: 0 });
    }
    const votes = await readVotes(store, cat);

    if (c.kind === "guess") {
      const answer = answerRaw.filter((id) => rows.has(id));
      const answerSet = new Set(answer);
      const detectives = [];
      for (const v of votes) {
        const picks = v.picks.filter((id) => rows.has(id));
        picks.forEach((id) => rows.get(id).guesses++);
        detectives.push({
          name: v.name || "Anonymous",
          correct: picks.filter((id) => answerSet.has(id)).length,
          picks: picks.map((id) => rows.get(id).name),
          at: v.at || 0,
        });
      }
      detectives.sort((a, b) => b.correct - a.correct || a.at - b.at);
      const suspects = [...rows.values()].sort((a, b) => b.guesses - a.guesses || a.name.localeCompare(b.name));
      results[cat] = { kind: "guess", voters: votes.length, suspects, answer, detectives };
      continue;
    }

    for (const v of votes) {
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
    results[cat] = { kind: "rank", voters: votes.length, ranking };
  }
  return results;
}
