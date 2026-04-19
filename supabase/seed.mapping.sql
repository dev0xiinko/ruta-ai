-- Generated mapping seed for known route places
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
('Apas', 'Cebu', 10.3364, 123.9181, 'manual_seed_known_places'),
('IT Park', 'Cebu', 10.3296, 123.9067, 'manual_seed_known_places'),
('Colon', 'Cebu', 10.2955, 123.9023, 'manual_seed_known_places'),
('Metro Colon', 'Cebu', 10.2962, 123.9016, 'manual_seed_known_places'),
('Colonnade', 'Cebu', 10.2957, 123.9009, 'manual_seed_known_places'),
('Carbon', 'Cebu', 10.2921, 123.8986, 'manual_seed_known_places'),
('Ayala', 'Cebu', 10.3173, 123.9058, 'manual_seed_known_places'),
('SM City Cebu', 'Cebu', 10.3111, 123.918, 'manual_seed_known_places'),
('Parkmall', 'Cebu', 10.3307, 123.9372, 'manual_seed_known_places'),
('Lahug', 'Cebu', 10.3338, 123.9032, 'manual_seed_known_places'),
('JY Square', 'Cebu', 10.3331, 123.899, 'manual_seed_known_places'),
('Fuente Osmena', 'Cebu', 10.3066, 123.8945, 'manual_seed_known_places'),
('Robinsons Fuente', 'Cebu', 10.3084, 123.8935, 'manual_seed_known_places'),
('Taboan', 'Cebu', 10.2924, 123.8918, 'manual_seed_known_places'),
('Mandaue', 'Cebu', 10.3236, 123.9228, 'manual_seed_known_places'),
('Ouano', 'Cebu', 10.3239, 123.9316, 'manual_seed_known_places'),
('Centro Mandaue', 'Cebu', 10.3234, 123.933, 'manual_seed_known_places'),
('Opon', 'Cebu', 10.3103, 123.9494, 'manual_seed_known_places'),
('Lapu-Lapu', 'Cebu', 10.3103, 123.9494, 'manual_seed_known_places'),
('Gorordo Ave', 'Cebu', 10.3193, 123.8999, 'manual_seed_known_places'),
('Salinas Drive', 'Cebu', 10.3282, 123.9044, 'manual_seed_known_places'),
('Juan Luna Ave', 'Cebu', 10.3098, 123.9128, 'manual_seed_known_places'),
('Magallanes St', 'Cebu', 10.294, 123.9001, 'manual_seed_known_places'),
('Progreso St', 'Cebu', 10.2918, 123.8963, 'manual_seed_known_places'),
('Asian College of Technology', 'Cebu', 10.2972, 123.9008, 'manual_seed_known_places'),
('Cebu Institute of Technology University CITU', 'Cebu', 10.2949, 123.8855, 'manual_seed_known_places'),
('University of Cebu Main Campus', 'Cebu', 10.2988, 123.8994, 'manual_seed_known_places'),
('University of Cebu Banilad Campus', 'Cebu', 10.3398, 123.9187, 'manual_seed_known_places'),
('Southwestern University', 'Cebu', 10.3018, 123.8928, 'manual_seed_known_places'),
('Southwestern University Basak Campus', 'Cebu', 10.2818, 123.8658, 'manual_seed_known_places'),
('University of Southern Philippines Foundation', 'Cebu', 10.3252, 123.8998, 'manual_seed_known_places'),
('University of the Philippines Cebu', 'Cebu', 10.3231, 123.8996, 'manual_seed_known_places'),
('University of Visayas Main Campus', 'Cebu', 10.2966, 123.9012, 'manual_seed_known_places'),
('Cebu Technological University Main Campus', 'Cebu', 10.3033, 123.9019, 'manual_seed_known_places'),
('Cebu Normal University', 'Cebu', 10.3016, 123.9003, 'manual_seed_known_places'),
('University of San Jose Recoletos', 'Cebu', 10.2947, 123.8979, 'manual_seed_known_places'),
('Cebu Doctors University', 'Cebu', 10.3156, 123.8993, 'manual_seed_known_places'),
('Cebu Doctors University Hospital', 'Cebu', 10.3099, 123.8942, 'manual_seed_known_places'),
('University of San Carlos Talamban Campus', 'Cebu', 10.3547, 123.9115, 'manual_seed_known_places'),
('University of San Carlos Main Campus', 'Cebu', 10.2974, 123.8997, 'manual_seed_known_places')
on conflict (canonical_name) do update
set city = excluded.city,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    source = excluded.source;

insert into public.route_place_aliases (place_id, alias)
select id, 'apas'
from public.route_places
where canonical_name = 'Apas'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'it park'
from public.route_places
where canonical_name = 'IT Park'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'colon'
from public.route_places
where canonical_name = 'Colon'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'metro colon'
from public.route_places
where canonical_name = 'Metro Colon'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'colonnade'
from public.route_places
where canonical_name = 'Colonnade'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'carbon'
from public.route_places
where canonical_name = 'Carbon'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'carbon public market'
from public.route_places
where canonical_name = 'Carbon'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'ayala'
from public.route_places
where canonical_name = 'Ayala'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'ayala center'
from public.route_places
where canonical_name = 'Ayala'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'sm'
from public.route_places
where canonical_name = 'SM City Cebu'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'sm city'
from public.route_places
where canonical_name = 'SM City Cebu'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'sm city cebu'
from public.route_places
where canonical_name = 'SM City Cebu'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'parkmall'
from public.route_places
where canonical_name = 'Parkmall'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'lahug'
from public.route_places
where canonical_name = 'Lahug'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'jy square'
from public.route_places
where canonical_name = 'JY Square'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'fuente'
from public.route_places
where canonical_name = 'Fuente Osmena'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'fuente osmena'
from public.route_places
where canonical_name = 'Fuente Osmena'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'robinsons fuente'
from public.route_places
where canonical_name = 'Robinsons Fuente'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'taboan'
from public.route_places
where canonical_name = 'Taboan'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'taboan public market'
from public.route_places
where canonical_name = 'Taboan'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'mandaue'
from public.route_places
where canonical_name = 'Mandaue'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'ouano'
from public.route_places
where canonical_name = 'Ouano'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'centro mandaue'
from public.route_places
where canonical_name = 'Centro Mandaue'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'opon'
from public.route_places
where canonical_name = 'Opon'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'lapu lapu'
from public.route_places
where canonical_name = 'Lapu-Lapu'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'lapu-lapu'
from public.route_places
where canonical_name = 'Lapu-Lapu'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'gorordo ave'
from public.route_places
where canonical_name = 'Gorordo Ave'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'salinas drive'
from public.route_places
where canonical_name = 'Salinas Drive'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'juan luna ave'
from public.route_places
where canonical_name = 'Juan Luna Ave'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'magallanes st'
from public.route_places
where canonical_name = 'Magallanes St'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'progreso st'
from public.route_places
where canonical_name = 'Progreso St'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'act'
from public.route_places
where canonical_name = 'Asian College of Technology'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'asian college of technology'
from public.route_places
where canonical_name = 'Asian College of Technology'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cit'
from public.route_places
where canonical_name = 'Cebu Institute of Technology University CITU'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cit-u'
from public.route_places
where canonical_name = 'Cebu Institute of Technology University CITU'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cit u'
from public.route_places
where canonical_name = 'Cebu Institute of Technology University CITU'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'citu'
from public.route_places
where canonical_name = 'Cebu Institute of Technology University CITU'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cit university'
from public.route_places
where canonical_name = 'Cebu Institute of Technology University CITU'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cebu institute of technology'
from public.route_places
where canonical_name = 'Cebu Institute of Technology University CITU'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cebu institute of technology university'
from public.route_places
where canonical_name = 'Cebu Institute of Technology University CITU'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cebu institute of technological university'
from public.route_places
where canonical_name = 'Cebu Institute of Technology University CITU'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'uc'
from public.route_places
where canonical_name = 'University of Cebu Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'ucm'
from public.route_places
where canonical_name = 'University of Cebu Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'uc main'
from public.route_places
where canonical_name = 'University of Cebu Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'uc main campus'
from public.route_places
where canonical_name = 'University of Cebu Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of cebu'
from public.route_places
where canonical_name = 'University of Cebu Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of cebu main'
from public.route_places
where canonical_name = 'University of Cebu Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of cebu main campus'
from public.route_places
where canonical_name = 'University of Cebu Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'uc banilad'
from public.route_places
where canonical_name = 'University of Cebu Banilad Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'uc banilad campus'
from public.route_places
where canonical_name = 'University of Cebu Banilad Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of cebu banilad'
from public.route_places
where canonical_name = 'University of Cebu Banilad Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of cebu banilad campus'
from public.route_places
where canonical_name = 'University of Cebu Banilad Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'swu'
from public.route_places
where canonical_name = 'Southwestern University'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'south western university'
from public.route_places
where canonical_name = 'Southwestern University'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'southwestern university'
from public.route_places
where canonical_name = 'Southwestern University'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'swu basak'
from public.route_places
where canonical_name = 'Southwestern University Basak Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'southwestern university basak campus'
from public.route_places
where canonical_name = 'Southwestern University Basak Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'uspf'
from public.route_places
where canonical_name = 'University of Southern Philippines Foundation'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'universit of southern philippines foundation'
from public.route_places
where canonical_name = 'University of Southern Philippines Foundation'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of southern philippines foundation'
from public.route_places
where canonical_name = 'University of Southern Philippines Foundation'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'up'
from public.route_places
where canonical_name = 'University of the Philippines Cebu'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'upc'
from public.route_places
where canonical_name = 'University of the Philippines Cebu'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'up cebu'
from public.route_places
where canonical_name = 'University of the Philippines Cebu'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'up lahug'
from public.route_places
where canonical_name = 'University of the Philippines Cebu'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of the philippines'
from public.route_places
where canonical_name = 'University of the Philippines Cebu'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of the philippines cebu'
from public.route_places
where canonical_name = 'University of the Philippines Cebu'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'uv'
from public.route_places
where canonical_name = 'University of Visayas Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'uv main'
from public.route_places
where canonical_name = 'University of Visayas Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of visayas'
from public.route_places
where canonical_name = 'University of Visayas Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of the visayas'
from public.route_places
where canonical_name = 'University of Visayas Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of visayas main'
from public.route_places
where canonical_name = 'University of Visayas Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of the visayas main'
from public.route_places
where canonical_name = 'University of Visayas Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of visayas main campus'
from public.route_places
where canonical_name = 'University of Visayas Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of the visayas main campus'
from public.route_places
where canonical_name = 'University of Visayas Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'ctu'
from public.route_places
where canonical_name = 'Cebu Technological University Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'ctu main'
from public.route_places
where canonical_name = 'Cebu Technological University Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'ctu main campus'
from public.route_places
where canonical_name = 'Cebu Technological University Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cebu technological university'
from public.route_places
where canonical_name = 'Cebu Technological University Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cebu technological university main'
from public.route_places
where canonical_name = 'Cebu Technological University Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cebu technological university main campus'
from public.route_places
where canonical_name = 'Cebu Technological University Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cnu'
from public.route_places
where canonical_name = 'Cebu Normal University'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cebu normal university'
from public.route_places
where canonical_name = 'Cebu Normal University'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'usjr'
from public.route_places
where canonical_name = 'University of San Jose Recoletos'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of san jose recoletos'
from public.route_places
where canonical_name = 'University of San Jose Recoletos'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cdu'
from public.route_places
where canonical_name = 'Cebu Doctors University'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cebu doctors university'
from public.route_places
where canonical_name = 'Cebu Doctors University'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cdu hospital'
from public.route_places
where canonical_name = 'Cebu Doctors University Hospital'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'cebu doctors university hospital'
from public.route_places
where canonical_name = 'Cebu Doctors University Hospital'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'usc tc'
from public.route_places
where canonical_name = 'University of San Carlos Talamban Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'usc tc campus'
from public.route_places
where canonical_name = 'University of San Carlos Talamban Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'usc talamban'
from public.route_places
where canonical_name = 'University of San Carlos Talamban Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'usc talamban campus'
from public.route_places
where canonical_name = 'University of San Carlos Talamban Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of san carlos talamban'
from public.route_places
where canonical_name = 'University of San Carlos Talamban Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of san carlos talamban campus'
from public.route_places
where canonical_name = 'University of San Carlos Talamban Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'usc main'
from public.route_places
where canonical_name = 'University of San Carlos Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'usc main campus'
from public.route_places
where canonical_name = 'University of San Carlos Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'usc downtown'
from public.route_places
where canonical_name = 'University of San Carlos Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'usc downtown campus'
from public.route_places
where canonical_name = 'University of San Carlos Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of san carlos main'
from public.route_places
where canonical_name = 'University of San Carlos Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'university of san carlos main campus'
from public.route_places
where canonical_name = 'University of San Carlos Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'downtown campus'
from public.route_places
where canonical_name = 'University of San Carlos Main Campus'
on conflict (place_id, alias) do nothing;

insert into public.route_place_aliases (place_id, alias)
select id, 'main campus'
from public.route_places
where canonical_name = 'University of San Carlos Main Campus'
on conflict (place_id, alias) do nothing;

commit;
