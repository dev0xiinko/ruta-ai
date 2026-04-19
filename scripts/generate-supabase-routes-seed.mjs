import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const inputPath = resolve("scrapper/validation/cebu_jeepney_routes_validated.json");
const outputPath = resolve("supabase/seed.sql");

const dataset = JSON.parse(readFileSync(inputPath, "utf8"));

function sqlString(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }

  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value ?? null))}::jsonb`;
}

const routeRows = dataset.routes
  .map((route) => {
    return `(
  ${sqlString(dataset.dataset_name)},
  ${sqlString(route.code)},
  ${sqlString(route.label)},
  ${sqlString(route.route_name)},
  ${sqlString(route.origin)},
  ${sqlString(route.destination)},
  ${sqlString(route.qa_status)},
  ${Number(route.completeness_score ?? 0)},
  ${sqlJson(route.source_urls)},
  ${sqlJson(route.roads)},
  ${sqlJson(route.schools)},
  ${sqlJson(route.malls_groceries)},
  ${sqlJson(route.churches)},
  ${sqlJson(route.government)},
  ${sqlJson(route.hotels)},
  ${sqlJson(route.health)},
  ${sqlJson(route.terminals)},
  ${sqlJson(route.info)},
  ${sqlJson(route.raw_sections)},
  ${sqlJson(route.warnings)}
)`;
  })
  .join(",\n");

const sql = `-- Generated from ${inputPath}
-- Seed data for Supabase/Postgres
-- Route count: ${dataset.route_count}

BEGIN;

INSERT INTO public.jeepney_datasets (
  dataset_name,
  generated_from,
  route_count,
  qa_summary
)
VALUES (
  ${sqlString(dataset.dataset_name)},
  ${sqlJson(dataset.generated_from)},
  ${Number(dataset.route_count ?? dataset.routes.length)},
  ${sqlJson(dataset.qa_summary ?? {})}
)
ON CONFLICT (dataset_name) DO UPDATE
SET generated_from = EXCLUDED.generated_from,
    route_count = EXCLUDED.route_count,
    qa_summary = EXCLUDED.qa_summary,
    imported_at = NOW();

INSERT INTO public.jeepney_routes (
  dataset_name,
  code,
  label,
  route_name,
  origin,
  destination,
  qa_status,
  completeness_score,
  source_urls,
  roads,
  schools,
  malls_groceries,
  churches,
  government,
  hotels,
  health,
  terminals,
  info,
  raw_sections,
  warnings
)
VALUES
${routeRows}
ON CONFLICT (dataset_name, code) DO UPDATE
SET label = EXCLUDED.label,
    route_name = EXCLUDED.route_name,
    origin = EXCLUDED.origin,
    destination = EXCLUDED.destination,
    qa_status = EXCLUDED.qa_status,
    completeness_score = EXCLUDED.completeness_score,
    source_urls = EXCLUDED.source_urls,
    roads = EXCLUDED.roads,
    schools = EXCLUDED.schools,
    malls_groceries = EXCLUDED.malls_groceries,
    churches = EXCLUDED.churches,
    government = EXCLUDED.government,
    hotels = EXCLUDED.hotels,
    health = EXCLUDED.health,
    terminals = EXCLUDED.terminals,
    info = EXCLUDED.info,
    raw_sections = EXCLUDED.raw_sections,
    warnings = EXCLUDED.warnings,
    imported_at = NOW();

COMMIT;
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sql);

console.log(`Wrote ${outputPath}`);
