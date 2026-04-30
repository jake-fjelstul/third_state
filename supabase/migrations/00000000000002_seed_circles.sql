-- =============================================================================
-- SEED: Starter circles, hoops, and a few events
-- Notes:
--   * No circle_members or event_attendees are seeded — real users join after signup.
--   * member_count is set directly to give social proof; the trigger keeps it
--     accurate from this point forward.
--   * Seeded events have created_by = NULL; that's allowed by the schema.
-- =============================================================================

-- Use stable UUIDs so re-running this migration is a no-op (ON CONFLICT DO NOTHING).
do $$
declare
  v_climbers_id uuid := '11111111-1111-1111-1111-111111111111';
  v_coffee_id   uuid := '22222222-2222-2222-2222-222222222222';
  v_books_id    uuid := '33333333-3333-3333-3333-333333333333';
  v_creative_id uuid := '44444444-4444-4444-4444-444444444444';
  v_running_id  uuid := '55555555-5555-5555-5555-555555555555';
begin
  -- ---------------------------------------------------------------------------
  -- CIRCLES
  -- ---------------------------------------------------------------------------
  insert into public.circles (id, name, emoji, city, type, category, interest_tag, member_count, cover_gradient, description, vibe, rules)
  values
    (v_climbers_id, 'Austin Rock Climbers', '🧗', 'Austin, TX', 'open', 'outdoors', 'Rock Climbing', 184,
     'from-indigo-500 via-sky-500 to-emerald-400',
     'A welcoming crew of climbers who meet up for indoor bouldering sessions and weekend trips to Reimer''s Ranch and Barton Creek Greenbelt.',
     'Supportive, beginner-friendly, and stoked on sending.',
     array['Be kind to newer climbers.','Share beta respectfully.','No gatekeeping grades.','Safety checks before every climb.']),

    (v_coffee_id, 'Startup Coffee Club', '☕', 'Austin, TX', 'open', 'professional', 'Startups', 96,
     'from-sky-500 via-indigo-500 to-slate-900',
     'A weekly coffee circle for founders, operators, and folks curious about startups. Zero pitch decks, all real talk.',
     'Chill, thoughtful, and a little bit nerdy.',
     array['No unsolicited pitching.','Keep conversations confidential.','Be generous with intros when it makes sense.']),

    (v_books_id, 'Sunday Book Club', '📚', 'Austin, TX', 'private', 'social', 'Book Club', 42,
     'from-rose-400 via-fuchsia-500 to-indigo-500',
     'A cozy Sunday afternoon circle for people who love talking about books, not just finishing them.',
     'Soft, curious, and opinionated in the best way.',
     array['Spoiler warnings for recent releases.','One person speaks at a time.','Snacks are highly encouraged.']),

    (v_creative_id, 'Creative Minds Collective', '🎨', 'Austin, TX', 'private', 'creative', 'Art', 67,
     'from-amber-400 via-rose-500 to-fuchsia-600',
     'Designers, illustrators, and writers swapping work, going on gallery walks, and sharing critique sessions.',
     'Generous, honest, and a little bit weird.',
     array['Critique with kindness and specifics.','Credit collaborators.','Show up to at least one in-person event a month.']),

    (v_running_id, 'Lady Bird Runners', '🏃', 'Austin, TX', 'open', 'outdoors', 'Running', 128,
     'from-emerald-400 via-teal-500 to-sky-500',
     'Sunrise group runs around Lady Bird Lake. All paces welcome — we wait at landmarks.',
     'Early, sweaty, and full of breakfast taco plans.',
     array['No one runs alone — pair up at the start.','Bring water in summer.','Tacos after every Saturday run.'])
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------------------
  -- HOOPS (only on private circles)
  -- ---------------------------------------------------------------------------
  insert into public.hoops (circle_id, type, prompt, options, order_index) values
    (v_books_id, 'written',
     'What''s a book that genuinely changed how you think — and what changed?',
     null, 0),
    (v_books_id, 'multiplechoice',
     'How often can you commit to attending Sunday discussions?',
     array['Almost every Sunday','A couple times a month','Once a month','When a book really grabs me'],
     1),

    (v_creative_id, 'written',
     'Tell us about a piece of work you''ve made recently — what were you trying to do?',
     null, 0),
    (v_creative_id, 'multiplechoice',
     'Which best describes your practice?',
     array['Visual art (drawing, painting, illustration)','Design (graphic, product, type)','Writing','Photography','Mixed / something else'],
     1),
    (v_creative_id, 'written',
     'What kind of feedback do you give well?',
     null, 2)
  on conflict do nothing;

  -- ---------------------------------------------------------------------------
  -- EVENTS (a couple per circle so Schedule has content; attendees come later)
  -- ---------------------------------------------------------------------------
  insert into public.events (circle_id, title, starts_at, location, notes) values
    (v_climbers_id, 'Tuesday Night Bouldering at ABP',
     (current_date + interval '7 days' + time '19:00') at time zone 'America/Chicago',
     'Austin Bouldering Project, Springdale', null),
    (v_climbers_id, 'Reimer''s Ranch Sport Climbing Day',
     (current_date + interval '12 days' + time '09:00') at time zone 'America/Chicago',
     'Milton Reimer''s Ranch Park', 'Carpool from Mueller, leaves 8am.'),

    (v_coffee_id, 'Friday Founder Coffee',
     (current_date + interval '4 days' + time '08:30') at time zone 'America/Chicago',
     'Houndstooth Coffee, Frost Bank Tower', 'Topic: how you found your first 10 users.'),
    (v_coffee_id, 'Walk & Talk on the Trail',
     (current_date + interval '11 days' + time '08:00') at time zone 'America/Chicago',
     'Lady Bird Lake Boardwalk', null),

    (v_books_id, 'March Pick Discussion',
     (current_date + interval '13 days' + time '15:00') at time zone 'America/Chicago',
     'Patika Coffee, South Lamar', null),

    (v_creative_id, 'East Side Gallery Walk',
     (current_date + interval '5 days' + time '16:00') at time zone 'America/Chicago',
     'Canopy Austin', null),

    (v_running_id, 'Sunrise Community Run',
     (current_date + interval '3 days' + time '07:00') at time zone 'America/Chicago',
     'Lady Bird Lake Trail', 'Tacos at Veracruz after.')
  on conflict do nothing;
end $$;
