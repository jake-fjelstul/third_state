// supabase-js returns the *existing* channel when a topic name is reused.
// If two components (or a quick re-subscribe while the old channel is still
// being removed) use the same name, the second `.on()` throws "cannot add
// postgres_changes callbacks ... after subscribe()" and React unmounts the
// whole app. Every subscriber therefore gets its own topic name; the
// postgres_changes filter, not the topic, decides which rows arrive.
let seq = 0
export function uniqueTopic(base) {
  seq += 1
  return `${base}:${seq}:${Math.random().toString(36).slice(2, 8)}`
}
