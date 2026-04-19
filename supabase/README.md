# Supabase Setup

This project stores Cebu jeepney route data in Supabase/Postgres using:

- `supabase/migrations/20260419183000_create_jeepney_routes.sql` for schema
- `supabase/migrations/20260419210000_create_route_places.sql` for known place coordinates + aliases
- `supabase/seed.sql` for dataset inserts generated from `scrapper/validation/cebu_jeepney_routes_validated.json`
- `supabase/seed.mapping.sql` for database-backed known place coordinates used by schematic maps
- `supabase/route-mapping-model.sql` as a proposed future mapping schema for true stop/shape/transfer data
- `docs/dataset-structure.md` for the current persisted dataset shape plus the normalized runtime route model used by the deterministic route engine

Regenerate the seed file after scraper updates:

```bash
npm run db:routes:generate
npm run db:mapping:generate
```

If you are using the Supabase CLI locally:

```bash
supabase db push
psql "$DATABASE_URL" -f supabase/seed.sql
```

If you are using the Supabase dashboard only:

1. Open the SQL editor.
2. Run the migration file.
3. Run `supabase/seed.sql`.
4. Run `supabase/seed.mapping.sql`.

Notes:

- The current app can show a basic schematic map response from recognized places in the dataset.
- `supabase/route-mapping-model.sql` is not applied yet. It is a design file for future real mapping support with route variants, stops, shapes, and transfer points.
