# Noah's 2026 Halloween Party Kickback: costume voting

Guest page: `/`   ·   Host page: `/admin.html` (PIN = ADMIN_PIN env var, defaults to 1031)

## Deploy (no terminal)
1. Create a new GitHub repo and upload everything in this folder (keep the folder structure).
2. Netlify → Add new site → Import from Git → pick the repo. Leave build settings as-is (netlify.toml handles it).
3. Site configuration → Environment variables → add `ADMIN_PIN` with your own PIN → redeploy.

Note: Netlify's drag-and-drop deploy does NOT run functions, so voting won't work that way. Use Git (above) or `npx netlify-cli deploy --prod`.

## Scoring
1st = 3 pts, 2nd = 2, 3rd = 1. Ties broken by most 1st-place votes, then 2nd-place votes.
One vote per phone per category; guests can change their picks until you close voting.
