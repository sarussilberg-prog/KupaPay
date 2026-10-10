# Store screenshots — dev sample data

Marketing owns final screenshots (#62). For a **clean local/demo state**:

1. Use the **development** Supabase project only (`drxfbicunusmipdgbgdk`) — see [docs/SSOT/SUPABASE_ENVIRONMENTS.md](SSOT/SUPABASE_ENVIRONMENTS.md).
2. Copy `cost-share-app/supabase/.env.example` → `supabase/.env` with `SUPABASE_SERVICE_ROLE_KEY` and `SEED_DEV_PASSWORD`.
3. From `cost-share-app/`: **`npm run seed`**

This wipes and recreates sample users (John/Jane/Bob), three groups, expenses, and balances suitable for demo captures. Switch the mobile app to dev `.env`, sign in as `john@example.com` / your seed password, and capture Hebrew UI + Bit/PayBox settle-up flows.

Do **not** run seed against production.
