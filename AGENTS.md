# RealSSA house rules

- Canonical production source is `E:\realssa-main (2)\realssa-main`.
- Never edit `E:\realssa-main (2)\realssa-main\realssa-main` (the nested copy).
- Vercel resolves `api/index.js` to the canonical shallow `backend/server.js` via `require('../backend/server.js')`.
- Before declaring backend work complete, install dependencies in this canonical workspace and require/boot-test the actual server entrypoint.
