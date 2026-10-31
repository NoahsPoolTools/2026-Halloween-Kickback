import { party } from "../lib/common.mjs";

export default async (req, context) => {
  const id = String(context.params?.id || "").replace(/[^a-z0-9-]/gi, "");
  if (!id) return new Response("Not found", { status: 404 });
  const hit = await party().getWithMetadata(`photos/${id}`, { type: "arrayBuffer" });
  if (!hit) return new Response("Not found", { status: 404 });
  return new Response(hit.data, {
    headers: {
      "content-type": hit.metadata?.contentType || "image/jpeg",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
};

export const config = { path: "/api/photo/:id" };
