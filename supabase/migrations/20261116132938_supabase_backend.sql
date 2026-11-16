-- Initial Supabase backend schema. Kept at the version already applied remotely.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.private_contributions (
  id uuid primary key default gen_random_uuid(),
  tx_hash text not null unique,
  network text not null check (network in ('btc','bsc')),
  recipient text not null,
  sender text,
  amount_num numeric(38,18) not null check (amount_num > 0),
  amount_display text not null,
  note text,
  raw_payload jsonb not null default '{}'::jsonb,
  verified_at timestamptz not null default now()
);
create table if not exists public.public_leaderboard (
  id uuid primary key default gen_random_uuid(),
  tx_hash text not null unique,
  display_name text not null,
  network text not null check (network in ('BTC','BEP-20')),
  amount_display text not null,
  amount_num numeric(38,18) not null check (amount_num > 0),
  status text not null default 'verified' check (status in ('verified','hidden')),
  verified_at timestamptz not null default now()
);
create index if not exists public_leaderboard_verified_at_idx on public.public_leaderboard (verified_at desc);
create table if not exists public.app_settings (
  id smallint primary key default 1 check (id = 1),
  btc_address text not null,
  bsc_address text not null,
  btc_network text not null default 'mainnet' check (btc_network in ('mainnet','testnet')),
  bsc_rpc_url text not null default 'https://bsc-dataseed.binance.org',
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id,btc_address,bsc_address)
values (1,'bc1qtgyrpyrmaf2vampf7ngt4xj4l3rh5kf7yy6qd8','0xE826cb2130425B31F89512F944B2784F2d97d732')
on conflict (id) do nothing;
create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  updated_at timestamptz not null default now()
);
insert into public.admin_users (username,password_hash)
values ('Admin','pbkdf2_sha256$310000$rYGVt3YPVunXdqdCua5eXA$uki3WZfmxb-9_8iS944sNyHApWzlL1Cl_4Dd_ZVKDYA')
on conflict (username) do nothing;
create table if not exists public.verification_rate_limits (
  id bigserial primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists verification_rate_limits_ip_time_idx on public.verification_rate_limits (ip_hash, created_at desc);

alter table public.private_contributions enable row level security;
alter table public.public_leaderboard enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_users enable row level security;
alter table public.verification_rate_limits enable row level security;

do $$ begin
  create policy private_contributions_deny_anon on public.private_contributions for all to anon using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy private_contributions_deny_authenticated on public.private_contributions for all to authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy app_settings_deny_anon on public.app_settings for all to anon using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy app_settings_deny_authenticated on public.app_settings for all to authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy admin_users_deny_anon on public.admin_users for all to anon using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy admin_users_deny_authenticated on public.admin_users for all to authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy rate_limits_deny_anon on public.verification_rate_limits for all to anon using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy rate_limits_deny_authenticated on public.verification_rate_limits for all to authenticated using (false) with check (false);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy leaderboard_public_read on public.public_leaderboard for select to anon using (status = 'verified');
exception when duplicate_object then null; end $$;
do $$ begin
  create policy leaderboard_authenticated_read on public.public_leaderboard for select to authenticated using (status = 'verified');
exception when duplicate_object then null; end $$;

revoke all on public.private_contributions, public.app_settings, public.admin_users, public.verification_rate_limits from anon, authenticated;
revoke insert, update, delete on public.public_leaderboard from anon, authenticated;
grant select on public.public_leaderboard to anon, authenticated;
grant all on public.private_contributions, public.public_leaderboard, public.app_settings, public.admin_users, public.verification_rate_limits to service_role;
grant usage, select on sequence public.verification_rate_limits_id_seq to service_role;
do $$ begin
  alter publication supabase_realtime add table public.public_leaderboard;
exception when duplicate_object then null; when undefined_object then null; end $$;
