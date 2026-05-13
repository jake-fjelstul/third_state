UPDATE public.circles c
SET member_count = (
  SELECT count(*) FROM public.circle_members cm WHERE cm.circle_id = c.id
);
