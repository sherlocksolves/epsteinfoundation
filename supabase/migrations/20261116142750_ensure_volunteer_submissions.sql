-- Volunteer and community feedback submissions.
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
revoke all on public.volunteer_submissions from anon, authenticated;
grant all on public.volunteer_submissions to service_role;
