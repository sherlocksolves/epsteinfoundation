create table if not exists public.volunteer_submissions (
  id uuid primary key default gen_random_uuid(),
  submission_type text not null default 'volunteer',
  full_name text not null,
  contact text not null,
  location text,
  role text,
  message text not null,
  created_at timestamptz not null default now()
);
alter table public.volunteer_submissions enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='volunteer_submissions'
      and policyname='volunteer_submissions_deny_anon'
  ) then
    create policy volunteer_submissions_deny_anon
      on public.volunteer_submissions for all to anon
      using (false) with check (false);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='volunteer_submissions'
      and policyname='volunteer_submissions_deny_authenticated'
  ) then
    create policy volunteer_submissions_deny_authenticated
      on public.volunteer_submissions for all to authenticated
      using (false) with check (false);
  end if;
end $$;
revoke all on public.volunteer_submissions from anon, authenticated;
grant all on public.volunteer_submissions to service_role;
do $$
begin
  alter publication supabase_realtime add table public.public_leaderboard;
exception when duplicate_object then null;
when undefined_object then null;
end $$;
