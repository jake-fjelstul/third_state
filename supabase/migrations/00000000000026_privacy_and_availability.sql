-- =============================================================================
-- THIRD SPACE — PHASE 1: Privacy & Availability
-- =============================================================================
-- Adds a per-user `privacy` JSONB on profiles. Privacy of profile fields is
-- enforced at the application layer for v1: the JSONB is readable by any
-- authenticated user (consistent with existing profiles RLS), and the React
-- UI honors the flags. A future hardening pass can move enforcement into
-- a SECURITY DEFINER profile-view function. This is intentional and documented.
-- =============================================================================

alter table public.profiles
  add column if not exists privacy jsonb not null default jsonb_build_object(
    'isPrivateProfile', false,
    'showBio',          true,
    'showInterests',    true,
    'showCircles',      true,
    'showLocation',     true,
    'showAvailability', true
  );

comment on column public.profiles.privacy is
  'Per-section visibility flags. Enforced at app layer in v1. Keys: isPrivateProfile, showBio, showInterests, showCircles, showLocation, showAvailability.';

-- Backfill any existing rows whose privacy ended up NULL despite the default
update public.profiles
   set privacy = jsonb_build_object(
     'isPrivateProfile', false,
     'showBio',          true,
     'showInterests',    true,
     'showCircles',      true,
     'showLocation',     true,
     'showAvailability', true
   )
 where privacy is null;
