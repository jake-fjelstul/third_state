drop policy if exists "users join open circles or accept own approved app" on public.circle_members;

create policy "join open or via approved app or organizer"
  on public.circle_members for insert to authenticated
  with check (
    auth.uid() = user_id
    and (
      exists (select 1 from public.circles c where c.id = circle_id and c.type = 'open')
      or exists (
        select 1 from public.applications a
        where a.circle_id = circle_id
          and a.applicant_id = auth.uid()
          and a.status = 'approved'
      )
      or exists (select 1 from public.circles c where c.id = circle_id and c.organizer_id = auth.uid())
    )
  );
