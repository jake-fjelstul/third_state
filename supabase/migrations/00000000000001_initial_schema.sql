-- =============================================================================
-- THIRD SPACE — INITIAL SCHEMA
-- =============================================================================



-- =============================================================================
-- PROFILES (extends auth.users 1:1)
-- =============================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  age int,
  city text,
  bio text,
  avatar_url text,
  intents text[] default '{}',
  interests text[] default '{}',
  onboarding_complete boolean default false,
  reconnect_threshold_days int default 21,
  search_radius int default 10,
  theme text default 'dark',
  battery_points int default 40,
  last_active_date date default current_date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- =============================================================================
-- CIRCLES
-- =============================================================================
create table public.circles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text,
  city text,
  type text not null check (type in ('open','private')),
  category text,
  interest_tag text,
  member_count int default 0,
  cover_gradient text,
  description text,
  vibe text,
  rules text[] default '{}',
  organizer_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- =============================================================================
-- CIRCLE MEMBERS
-- =============================================================================
create table public.circle_members (
  circle_id uuid references public.circles(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  role text default 'member' check (role in ('member','organizer','host')),
  joined_at timestamptz default now(),
  primary key (circle_id, user_id)
);

create index idx_circle_members_user on public.circle_members(user_id);

-- =============================================================================
-- HOOPS (application gating questions on circles)
-- =============================================================================
create table public.hoops (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  type text not null check (type in ('written','multiplechoice')),
  prompt text not null,
  options text[],
  order_index int not null default 0
);

create index idx_hoops_circle on public.hoops(circle_id);

-- =============================================================================
-- APPLICATIONS
-- =============================================================================
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  unique (circle_id, applicant_id)
);

create table public.application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  hoop_id uuid not null references public.hoops(id) on delete cascade,
  answer text
);

-- =============================================================================
-- EVENTS
-- =============================================================================
create table public.events (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid references public.circles(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  location text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index idx_events_circle on public.events(circle_id);
create index idx_events_starts_at on public.events(starts_at);

create table public.event_attendees (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  primary key (event_id, user_id)
);

create index idx_event_attendees_user on public.event_attendees(user_id);

-- =============================================================================
-- CHATS
-- =============================================================================
create table public.chats (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('dm','group')),
  circle_id uuid references public.circles(id) on delete cascade,
  name text,
  created_at timestamptz default now()
);

create table public.chat_members (
  chat_id uuid references public.chats(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  last_read_at timestamptz default now(),
  primary key (chat_id, user_id)
);

create index idx_chat_members_user on public.chat_members(user_id);

create table public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  name text not null,
  unique (chat_id, name)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  channel_id uuid references public.chat_channels(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  text text not null,
  created_at timestamptz default now()
);

create index idx_messages_chat_created on public.messages(chat_id, created_at desc);
create index idx_messages_channel on public.messages(channel_id, created_at desc);

-- =============================================================================
-- CONNECTIONS
-- =============================================================================
create table public.connections (
  user_id uuid references public.profiles(id) on delete cascade,
  connected_user_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  last_hangout timestamptz,
  primary key (user_id, connected_user_id),
  check (user_id <> connected_user_id)
);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  is_read boolean default false,
  created_at timestamptz default now()
);

create index idx_notifications_user_created on public.notifications(user_id, created_at desc);

-- =============================================================================
-- BATTERY HISTORY
-- =============================================================================
create table public.battery_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  points int not null,
  reason text,
  result int not null,
  created_at timestamptz default now()
);

create index idx_battery_user_created on public.battery_history(user_id, created_at desc);

-- =============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, age, city)
  values (
    new.id, 
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    (new.raw_user_meta_data->>'age')::int,
    new.raw_user_meta_data->>'city'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =============================================================================
-- KEEP CIRCLE member_count IN SYNC
-- =============================================================================
create or replace function public.sync_circle_member_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update public.circles set member_count = member_count + 1 where id = new.circle_id;
  elsif tg_op = 'DELETE' then
    update public.circles set member_count = greatest(member_count - 1, 0) where id = old.circle_id;
  end if;
  return null;
end;
$$;

create trigger trg_circle_member_count
  after insert or delete on public.circle_members
  for each row execute procedure public.sync_circle_member_count();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================
alter table public.profiles enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.hoops enable row level security;
alter table public.applications enable row level security;
alter table public.application_answers enable row level security;
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;
alter table public.chats enable row level security;
alter table public.chat_members enable row level security;
alter table public.chat_channels enable row level security;
alter table public.messages enable row level security;
alter table public.connections enable row level security;
alter table public.notifications enable row level security;
alter table public.battery_history enable row level security;

-- profiles
create policy "profiles readable by all authenticated users"
  on public.profiles for select to authenticated using (true);
create policy "users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- circles: anyone authenticated can read; only organizer can update/delete; any auth user can create
create policy "circles readable by authenticated"
  on public.circles for select to authenticated using (true);
create policy "auth users can create circles"
  on public.circles for insert to authenticated with check (auth.uid() = organizer_id);
create policy "organizer can update own circle"
  on public.circles for update to authenticated using (auth.uid() = organizer_id);
create policy "organizer can delete own circle"
  on public.circles for delete to authenticated using (auth.uid() = organizer_id);

-- circle_members
create policy "circle_members readable by authenticated"
  on public.circle_members for select to authenticated using (true);
create policy "users join open circles or accept own approved app"
  on public.circle_members for insert to authenticated with check (auth.uid() = user_id);
create policy "users leave their own membership"
  on public.circle_members for delete to authenticated using (auth.uid() = user_id);

-- hoops
create policy "hoops readable by authenticated"
  on public.hoops for select to authenticated using (true);
create policy "organizer manages hoops"
  on public.hoops for all to authenticated
  using (exists (select 1 from public.circles c where c.id = circle_id and c.organizer_id = auth.uid()))
  with check (exists (select 1 from public.circles c where c.id = circle_id and c.organizer_id = auth.uid()));

-- applications
create policy "applicant reads own apps"
  on public.applications for select to authenticated
  using (auth.uid() = applicant_id
         or exists (select 1 from public.circles c where c.id = circle_id and c.organizer_id = auth.uid()));
create policy "applicant creates own app"
  on public.applications for insert to authenticated with check (auth.uid() = applicant_id);
create policy "organizer reviews app"
  on public.applications for update to authenticated
  using (exists (select 1 from public.circles c where c.id = circle_id and c.organizer_id = auth.uid()));

-- application_answers
create policy "applicant or organizer reads answers"
  on public.application_answers for select to authenticated using (
    exists (
      select 1 from public.applications a
      left join public.circles c on c.id = a.circle_id
      where a.id = application_id
        and (a.applicant_id = auth.uid() or c.organizer_id = auth.uid())
    )
  );
create policy "applicant inserts own answers"
  on public.application_answers for insert to authenticated with check (
    exists (select 1 from public.applications a where a.id = application_id and a.applicant_id = auth.uid())
  );

-- events
create policy "events readable by authenticated"
  on public.events for select to authenticated using (true);
create policy "circle members create events"
  on public.events for insert to authenticated with check (
    exists (select 1 from public.circle_members m where m.circle_id = events.circle_id and m.user_id = auth.uid())
  );
create policy "creator updates own event"
  on public.events for update to authenticated using (auth.uid() = created_by);
create policy "creator deletes own event"
  on public.events for delete to authenticated using (auth.uid() = created_by);

-- event_attendees
create policy "event_attendees readable by authenticated"
  on public.event_attendees for select to authenticated using (true);
create policy "user RSVPs self"
  on public.event_attendees for insert to authenticated with check (auth.uid() = user_id);
create policy "user cancels own RSVP"
  on public.event_attendees for delete to authenticated using (auth.uid() = user_id);

-- chats / chat_members / messages
create policy "chat members read chat"
  on public.chats for select to authenticated using (
    exists (select 1 from public.chat_members m where m.chat_id = chats.id and m.user_id = auth.uid())
  );
create policy "auth user creates chat"
  on public.chats for insert to authenticated with check (true);

create policy "chat members read membership"
  on public.chat_members for select to authenticated
  using (auth.uid() = user_id
         or exists (select 1 from public.chat_members m2 where m2.chat_id = chat_members.chat_id and m2.user_id = auth.uid()));
create policy "user adds self to chat"
  on public.chat_members for insert to authenticated with check (auth.uid() = user_id);
create policy "user updates own chat membership"
  on public.chat_members for update to authenticated using (auth.uid() = user_id);
create policy "user removes own chat membership"
  on public.chat_members for delete to authenticated using (auth.uid() = user_id);

create policy "chat members read channels"
  on public.chat_channels for select to authenticated using (
    exists (select 1 from public.chat_members m where m.chat_id = chat_channels.chat_id and m.user_id = auth.uid())
  );
create policy "chat members create channels"
  on public.chat_channels for insert to authenticated with check (
    exists (select 1 from public.chat_members m where m.chat_id = chat_channels.chat_id and m.user_id = auth.uid())
  );

create policy "chat members read messages"
  on public.messages for select to authenticated using (
    exists (select 1 from public.chat_members m where m.chat_id = messages.chat_id and m.user_id = auth.uid())
  );
create policy "chat members send messages"
  on public.messages for insert to authenticated with check (
    auth.uid() = sender_id
    and exists (select 1 from public.chat_members m where m.chat_id = messages.chat_id and m.user_id = auth.uid())
  );

-- connections
create policy "user reads own connections"
  on public.connections for select to authenticated
  using (auth.uid() = user_id or auth.uid() = connected_user_id);
create policy "user creates own connection"
  on public.connections for insert to authenticated with check (auth.uid() = user_id);
create policy "user deletes own connection"
  on public.connections for delete to authenticated using (auth.uid() = user_id);

-- notifications
create policy "user reads own notifications"
  on public.notifications for select to authenticated using (auth.uid() = user_id);
create policy "user updates own notifications"
  on public.notifications for update to authenticated using (auth.uid() = user_id);
create policy "system inserts notifications"
  on public.notifications for insert to authenticated with check (true);

-- battery_history
create policy "user reads own battery"
  on public.battery_history for select to authenticated using (auth.uid() = user_id);
create policy "user inserts own battery"
  on public.battery_history for insert to authenticated with check (auth.uid() = user_id);
