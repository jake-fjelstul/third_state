alter table public.profiles
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

comment on column public.profiles.latitude is 'Decimal degrees, set when user picks a city from autocomplete or shares browser location.';
comment on column public.profiles.longitude is 'Decimal degrees, set when user picks a city from autocomplete or shares browser location.';
