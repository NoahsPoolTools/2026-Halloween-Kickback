import { party, json, getEntrants, getStatus, publicEntrant, CATEGORIES, PARTY_TITLE } from "../lib/common.mjs";

export default async () => {
  const store = party();
  const [entrants, status] = await Promise.all([getEntrants(store), getStatus(store)]);
  return json({
    title: PARTY_TITLE,
    categories: CATEGORIES,
    status,
    entrants: entrants.map(publicEntrant),
  });
};

export const config = { path: "/api/state" };
