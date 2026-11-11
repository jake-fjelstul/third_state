-- One-off test-data cleanup (plan-2026-11-10.md, J3). Run once with psql:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f scripts/cleanup-test-data.sql
-- Not a migration: this is data, not schema. Deleting auth.users cascades to
-- profiles and everything they own.
begin;

create temp table del_circles on commit drop as
select id, name from public.circles where id in (
  '7272641d-7fcf-4cc7-8dad-39fa3fb9b78f', -- Testt
  '395eb575-4b42-41f2-af9a-637021f448e5', -- asdfas
  '2da5686d-824e-42f4-b999-09b2ce94dcdd', -- tes
  '230e3574-4687-4ffe-b0f8-feae4b98cd8a', -- testing1
  '53ee1774-0a2a-4cdc-829e-4d9d10731fb4', -- testing
  'f6ca2f36-aa4d-4169-b975-ce7ac64c791c', -- ttttt
  '485cd149-6a25-42f7-a9bf-df75c6077fe1', -- testing (private)
  '87390799-1235-48a1-a708-195475a6a67e', -- vat
  'e97ab932-8c78-4d69-8d3e-d3d909a7495a', -- qqqqq
  '8dac10bb-bb7b-485e-a58a-f4580bd18dfc', -- zzzzzzzzz
  '9580e956-9ccc-4203-8023-e084e5607ac7', -- yyyyyyyy
  'f93a8a14-f588-4afd-a77b-23f11b8fec55', -- wwwwwwww
  'b6c066e6-9f17-4823-947a-e613304f0cd1', -- eeeeeeee
  'bf23e183-c18e-4d06-869f-819a033db07b', -- hhhhhh
  '8de06726-a89f-41f7-844a-a8199d6cfa4b', -- uuuuuu
  '6d256617-f47f-4134-a238-65f4ac5e30bb', -- bbbbbb
  'f4d4c08a-2808-47b5-a9fc-0344ad1af8d0', -- rrrrrrrr
  'c63f902d-c3bd-4b29-99be-c5742184a541'  -- Hi
);

create temp table del_users on commit drop as
select id, email from auth.users
 where email like '%@example.com'
    or email in (
      'investigator@test.com', 'test2@test.com', 'test2@test2.com', 'test3@test.com',
      'jack@test.com', 'john2@test.com', 'john3@test.com', 'jj@test.com', 'john4@test.com',
      -- Jake's own test logins
      'test@test.com', 'tst@tst.com', 'test1@gmail.com', 'testing@testing.com'
    );

select (select count(*) from del_circles) as circles_to_delete,
       (select count(*) from del_users) as users_to_delete;

-- Circle chats are tied to the circle; remove them explicitly in case the FK is set null.
delete from public.chats where circle_id in (select id from del_circles);
delete from public.circles where id in (select id from del_circles);
delete from auth.users where id in (select id from del_users);

-- Recount members for the circles that remain.
update public.circles c
   set member_count = (select count(*) from public.circle_members m where m.circle_id = c.id);

select (select count(*) from public.circles) as circles_left,
       (select count(*) from public.profiles) as profiles_left;

commit;

-- Follow-up (same day, approved by Jake): DMs left with fewer than two
-- members after the deletes above were one-sided ghost chats. Removed 20.
begin;
delete from public.chats c
 where c.type = 'dm'
   and (select count(*) from public.chat_members m where m.chat_id = c.id) < 2;
commit;
