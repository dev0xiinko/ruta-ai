import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve("supabase/seed.mapping.sql");

const KNOWN_PLACES = [
  { canonical_name: "Apas", lat: 10.3364, lng: 123.9181, aliases: ["apas"] },
  { canonical_name: "IT Park", lat: 10.3296, lng: 123.9067, aliases: ["it park"] },
  { canonical_name: "Colon", lat: 10.2955, lng: 123.9023, aliases: ["colon"] },
  { canonical_name: "Metro Colon", lat: 10.2962, lng: 123.9016, aliases: ["metro colon"] },
  { canonical_name: "Colonnade", lat: 10.2957, lng: 123.9009, aliases: ["colonnade"] },
  { canonical_name: "Carbon", lat: 10.2921, lng: 123.8986, aliases: ["carbon", "carbon public market"] },
  { canonical_name: "Ayala", lat: 10.3173, lng: 123.9058, aliases: ["ayala", "ayala center"] },
  { canonical_name: "SM City Cebu", lat: 10.3111, lng: 123.918, aliases: ["sm", "sm city", "sm city cebu"] },
  { canonical_name: "Parkmall", lat: 10.3307, lng: 123.9372, aliases: ["parkmall"] },
  { canonical_name: "Lahug", lat: 10.3338, lng: 123.9032, aliases: ["lahug"] },
  { canonical_name: "JY Square", lat: 10.3331, lng: 123.899, aliases: ["jy square"] },
  { canonical_name: "Fuente Osmena", lat: 10.3066, lng: 123.8945, aliases: ["fuente", "fuente osmena"] },
  { canonical_name: "Robinsons Fuente", lat: 10.3084, lng: 123.8935, aliases: ["robinsons fuente"] },
  { canonical_name: "Taboan", lat: 10.2924, lng: 123.8918, aliases: ["taboan", "taboan public market"] },
  { canonical_name: "Mandaue", lat: 10.3236, lng: 123.9228, aliases: ["mandaue"] },
  { canonical_name: "Ouano", lat: 10.3239, lng: 123.9316, aliases: ["ouano"] },
  { canonical_name: "Centro Mandaue", lat: 10.3234, lng: 123.933, aliases: ["centro mandaue"] },
  { canonical_name: "Opon", lat: 10.3103, lng: 123.9494, aliases: ["opon"] },
  { canonical_name: "Lapu-Lapu", lat: 10.3103, lng: 123.9494, aliases: ["lapu lapu", "lapu-lapu"] },
  { canonical_name: "Gorordo Ave", lat: 10.3193, lng: 123.8999, aliases: ["gorordo ave"] },
  { canonical_name: "Salinas Drive", lat: 10.3282, lng: 123.9044, aliases: ["salinas drive"] },
  { canonical_name: "Juan Luna Ave", lat: 10.3098, lng: 123.9128, aliases: ["juan luna ave"] },
  { canonical_name: "Magallanes St", lat: 10.294, lng: 123.9001, aliases: ["magallanes st"] },
  { canonical_name: "Progreso St", lat: 10.2918, lng: 123.8963, aliases: ["progreso st"] },

  // School and campus aliases. Coordinates are approximate campus anchors for alias resolution.
  { canonical_name: "Asian College of Technology", lat: 10.2972, lng: 123.9008, aliases: ["act", "asian college of technology"] },
  { canonical_name: "Cebu Institute of Technology University CITU", lat: 10.2949, lng: 123.8855, aliases: ["cit", "cit-u", "cit u", "citu", "cit university", "cebu institute of technology", "cebu institute of technology university", "cebu institute of technological university"] },
  { canonical_name: "University of Cebu Main Campus", lat: 10.2988, lng: 123.8994, aliases: ["uc", "ucm", "uc main", "uc main campus", "university of cebu", "university of cebu main", "university of cebu main campus"] },
  { canonical_name: "University of Cebu Banilad Campus", lat: 10.3398, lng: 123.9187, aliases: ["uc banilad", "uc banilad campus", "university of cebu banilad", "university of cebu banilad campus"] },
  { canonical_name: "Southwestern University", lat: 10.3018, lng: 123.8928, aliases: ["swu", "south western university", "southwestern university"] },
  { canonical_name: "Southwestern University Basak Campus", lat: 10.2818, lng: 123.8658, aliases: ["swu basak", "southwestern university basak campus"] },
  { canonical_name: "University of Southern Philippines Foundation", lat: 10.3252, lng: 123.8998, aliases: ["uspf", "universit of southern philippines foundation", "university of southern philippines foundation"] },
  { canonical_name: "University of the Philippines Cebu", lat: 10.3231, lng: 123.8996, aliases: ["up", "upc", "up cebu", "up lahug", "university of the philippines", "university of the philippines cebu"] },
  { canonical_name: "University of Visayas Main Campus", lat: 10.2966, lng: 123.9012, aliases: ["uv", "uv main", "university of visayas", "university of the visayas", "university of visayas main", "university of the visayas main", "university of visayas main campus", "university of the visayas main campus"] },
  { canonical_name: "Cebu Technological University Main Campus", lat: 10.3033, lng: 123.9019, aliases: ["ctu", "ctu main", "ctu main campus", "cebu technological university", "cebu technological university main", "cebu technological university main campus"] },
  { canonical_name: "Cebu Normal University", lat: 10.3016, lng: 123.9003, aliases: ["cnu", "cebu normal university"] },
  { canonical_name: "University of San Jose Recoletos", lat: 10.2947, lng: 123.8979, aliases: ["usjr", "university of san jose recoletos"] },
  { canonical_name: "Cebu Doctors University", lat: 10.3156, lng: 123.8993, aliases: ["cdu", "cebu doctors university"] },
  { canonical_name: "Cebu Doctors University Hospital", lat: 10.3099, lng: 123.8942, aliases: ["cdu hospital", "cebu doctors university hospital"] },
  { canonical_name: "University of San Carlos Talamban Campus", lat: 10.3547, lng: 123.9115, aliases: ["usc tc", "usc tc campus", "usc talamban", "usc talamban campus", "university of san carlos talamban", "university of san carlos talamban campus"] },
  { canonical_name: "University of San Carlos Main Campus", lat: 10.2974, lng: 123.8997, aliases: ["usc main", "usc main campus", "usc downtown", "usc downtown campus", "university of san carlos main", "university of san carlos main campus", "downtown campus", "main campus"] },
];

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const placeRows = KNOWN_PLACES
  .map(
    (place) =>
      `(${sqlString(place.canonical_name)}, 'Cebu', ${place.lat}, ${place.lng}, 'manual_seed_known_places')`
  )
  .join(",\n");

const aliasStatements = KNOWN_PLACES
  .flatMap((place) =>
    place.aliases.map(
      (alias) => `insert into public.route_place_aliases (place_id, alias)
select id, ${sqlString(alias)}
from public.route_places
where canonical_name = ${sqlString(place.canonical_name)}
on conflict (place_id, alias) do nothing;`
    )
  )
  .join("\n\n");

const sql = `-- Generated mapping seed for known route places
-- Purpose: bootstrap database-backed place coordinates for schematic maps

begin;

insert into public.route_places (
  canonical_name,
  city,
  latitude,
  longitude,
  source
)
values
${placeRows}
on conflict (canonical_name) do update
set city = excluded.city,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    source = excluded.source;

${aliasStatements}

commit;
`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, sql);

console.log(`Wrote ${outputPath}`);
