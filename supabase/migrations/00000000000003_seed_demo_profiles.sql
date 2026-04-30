-- =============================================================================
-- DEV SEED: Demo profiles for discovery and connections
-- WARNING: Delete this migration before production launch.
-- These 6 accounts have intentionally unusable password hashes; nobody can
-- log in as them. They exist only to populate the profiles table so Discovery,
-- search, and the Connections graph have realistic content during development.
-- =============================================================================

do $$
declare
  v_nia uuid    := 'aaaaaaaa-0001-0001-0001-000000000001';
  v_daniel uuid := 'aaaaaaaa-0002-0002-0002-000000000002';
  v_sophia uuid := 'aaaaaaaa-0003-0003-0003-000000000003';
  v_mateo uuid  := 'aaaaaaaa-0004-0004-0004-000000000004';
  v_emi uuid    := 'aaaaaaaa-0005-0005-0005-000000000005';
  v_jordan uuid := 'aaaaaaaa-0006-0006-0006-000000000006';
begin
  -- Insert demo auth users. The on_auth_user_created trigger creates
  -- corresponding profiles rows; we update them with rich data below.
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', v_nia, 'authenticated', 'authenticated',
     'nia.demo@thirdspace.local', '$2a$10$DEMO.SEED.NO.LOGIN.POSSIBLE.xxxxxxxxxxxxxxxxxxxxxx',
     now(), '{"provider":"email","providers":["email"]}'::jsonb,
     '{"name":"Nia Thompson"}'::jsonb, now(), now()),

    ('00000000-0000-0000-0000-000000000000', v_daniel, 'authenticated', 'authenticated',
     'daniel.demo@thirdspace.local', '$2a$10$DEMO.SEED.NO.LOGIN.POSSIBLE.xxxxxxxxxxxxxxxxxxxxxx',
     now(), '{"provider":"email","providers":["email"]}'::jsonb,
     '{"name":"Daniel Kim"}'::jsonb, now(), now()),

    ('00000000-0000-0000-0000-000000000000', v_sophia, 'authenticated', 'authenticated',
     'sophia.demo@thirdspace.local', '$2a$10$DEMO.SEED.NO.LOGIN.POSSIBLE.xxxxxxxxxxxxxxxxxxxxxx',
     now(), '{"provider":"email","providers":["email"]}'::jsonb,
     '{"name":"Sophia Patel"}'::jsonb, now(), now()),

    ('00000000-0000-0000-0000-000000000000', v_mateo, 'authenticated', 'authenticated',
     'mateo.demo@thirdspace.local', '$2a$10$DEMO.SEED.NO.LOGIN.POSSIBLE.xxxxxxxxxxxxxxxxxxxxxx',
     now(), '{"provider":"email","providers":["email"]}'::jsonb,
     '{"name":"Mateo Alvarez"}'::jsonb, now(), now()),

    ('00000000-0000-0000-0000-000000000000', v_emi, 'authenticated', 'authenticated',
     'emi.demo@thirdspace.local', '$2a$10$DEMO.SEED.NO.LOGIN.POSSIBLE.xxxxxxxxxxxxxxxxxxxxxx',
     now(), '{"provider":"email","providers":["email"]}'::jsonb,
     '{"name":"Emi Sato"}'::jsonb, now(), now()),

    ('00000000-0000-0000-0000-000000000000', v_jordan, 'authenticated', 'authenticated',
     'jordan.demo@thirdspace.local', '$2a$10$DEMO.SEED.NO.LOGIN.POSSIBLE.xxxxxxxxxxxxxxxxxxxxxx',
     now(), '{"provider":"email","providers":["email"]}'::jsonb,
     '{"name":"Jordan Lee"}'::jsonb, now(), now())
  on conflict (id) do nothing;

  -- Update profiles with the rich demo data.
  update public.profiles set
    age = 31, city = 'Austin, TX',
    bio = 'PM at a climate-tech startup. I climb at Austin Bouldering Project most nights and always down for a post-session taco.',
    interests = array['Rock Climbing','Startups','Tacos','Travel'],
    intents = array['Activity Partners','Professional Networking'],
    onboarding_complete = true,
    avatar_url = 'https://api.dicebear.com/7.x/notionists/svg?seed=Nia%20Thompson'
  where id = v_nia;

  update public.profiles set
    age = 27, city = 'Austin, TX',
    bio = 'Software engineer who takes coffee way too seriously. Exploring third wave spots around downtown.',
    interests = array['Coffee','Tech','Photography','Film'],
    intents = array['Coffee Chats','Activity Partners'],
    onboarding_complete = true,
    avatar_url = 'https://api.dicebear.com/7.x/notionists/svg?seed=Daniel%20Kim'
  where id = v_daniel;

  update public.profiles set
    age = 30, city = 'Austin, TX',
    bio = 'Marketing lead by day, book club host by Sunday. Always looking for new fiction recs.',
    interests = array['Book Club','Cooking','Music','Travel'],
    intents = array['Coffee Chats'],
    onboarding_complete = true,
    avatar_url = 'https://api.dicebear.com/7.x/notionists/svg?seed=Sophia%20Patel'
  where id = v_sophia;

  update public.profiles set
    age = 26, city = 'Austin, TX',
    bio = 'Weekend photographer and casual runner. Scouting new sunrise spots around Lady Bird Lake.',
    interests = array['Photography','Running','Hiking','Music'],
    intents = array['Activity Partners'],
    onboarding_complete = true,
    avatar_url = 'https://api.dicebear.com/7.x/notionists/svg?seed=Mateo%20Alvarez'
  where id = v_mateo;

  update public.profiles set
    age = 28, city = 'Austin, TX',
    bio = 'UX researcher, new to Austin from Seattle. Big on cozy cafes, board games, and low-key hangs.',
    interests = array['Coffee','Gaming','Yoga','Art'],
    intents = array['Coffee Chats'],
    onboarding_complete = true,
    avatar_url = 'https://api.dicebear.com/7.x/notionists/svg?seed=Emi%20Sato'
  where id = v_emi;

  update public.profiles set
    age = 33, city = 'Austin, TX',
    bio = 'Engineer turned founder. Building a tiny SaaS and running a Sunday founder circle.',
    interests = array['Startups','Tech','Coffee','Chess'],
    intents = array['Professional Networking'],
    onboarding_complete = true,
    avatar_url = 'https://api.dicebear.com/7.x/notionists/svg?seed=Jordan%20Lee'
  where id = v_jordan;

  -- Make Jordan the organizer of Startup Coffee Club so we can verify
  -- organizer-only flows during dev (the seeded circle has no organizer yet).
  update public.circles
    set organizer_id = v_jordan
    where id = '22222222-2222-2222-2222-222222222222';

  -- Make Sophia the organizer of Sunday Book Club (private circle with hoops).
  update public.circles
    set organizer_id = v_sophia
    where id = '33333333-3333-3333-3333-333333333333';

  -- Add demo profiles to circle_members so the avatar grids aren't empty.
  insert into public.circle_members (circle_id, user_id, role) values
    ('11111111-1111-1111-1111-111111111111', v_nia, 'member'),
    ('11111111-1111-1111-1111-111111111111', v_jordan, 'member'),
    ('22222222-2222-2222-2222-222222222222', v_jordan, 'organizer'),
    ('22222222-2222-2222-2222-222222222222', v_daniel, 'member'),
    ('33333333-3333-3333-3333-333333333333', v_sophia, 'organizer'),
    ('33333333-3333-3333-3333-333333333333', v_emi, 'member'),
    ('44444444-4444-4444-4444-444444444444', v_mateo, 'member'),
    ('55555555-5555-5555-5555-555555555555', v_mateo, 'member'),
    ('55555555-5555-5555-5555-555555555555', v_nia, 'member')
  on conflict (circle_id, user_id) do nothing;
end $$;
