-- =============================================================================
-- Circle icons: replace emoji with Lucide icon keys
-- =============================================================================

alter table public.circles
  add column if not exists icon text;

-- Backfill from the existing emoji vocabulary (the 24 options that were
-- offered in the circle creation form), mapping each to a Lucide icon name.
update public.circles set icon = case emoji
  when '✨'  then 'Sparkles'
  when '⭕'  then 'Circle'
  when '🔥'  then 'Flame'
  when '🎨'  then 'Palette'
  when '📸'  then 'Camera'
  when '⚽'  then 'Volleyball'
  when '🏃'  then 'Footprints'
  when '☕'  then 'Coffee'
  when '📚'  then 'BookOpen'
  when '🎵'  then 'Music'
  when '🎮'  then 'Gamepad2'
  when '🍕'  then 'Pizza'
  when '🧗'  then 'Mountain'
  when '🚲'  then 'Bike'
  when '🧘'  then 'Flower2'
  when '🎬'  then 'Clapperboard'
  when '🐶'  then 'Dog'
  when '✈️'  then 'Plane'
  when '💡'  then 'Lightbulb'
  when '🌱'  then 'Sprout'
  when '🏀'  then 'Dribbble'
  when '🎤'  then 'Mic'
  when '🎲'  then 'Dices'
  when '❤️'  then 'Heart'
  else 'Users'
end
where icon is null;

-- Any circle with no emoji at all gets the neutral default.
update public.circles set icon = 'Users' where icon is null or icon = '';
