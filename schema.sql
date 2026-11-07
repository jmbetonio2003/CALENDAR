-- Client Follow-Up Manager database schema.
-- Run in the SQL Editor of the dedicated Supabase project.
-- Review existing tables first. This script creates missing tables and adds core columns safely.

create extension if not exists pgcrypto;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  temperature text not null default 'warm' check (temperature in ('cold','warm','hot')),
  interested_model text,
  needs text,
  general_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time not null,
  priority text not null default 'normal' check (priority in ('normal','high','urgent')),
  reminder_minutes integer not null default 60,
  purpose text not null,
  status text not null default 'scheduled' check (status in ('scheduled','completed','missed','cancelled','rescheduled')),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  direction text not null default 'outgoing' check (direction = 'outgoing'),
  channel text not null default 'Other',
  occurred_at timestamptz not null default now(),
  notes text,
  client_questions text,
  agreed_next_steps text,
  transcript text,
  resulting_followup_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  model text,
  variant text,
  unit_price numeric(14,2),
  quotation_date date not null default current_date,
  status text not null default 'draft',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light',
  calendar_view text not null default 'month',
  landing_page text not null default 'dashboard',
  push_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

-- Add fields used by this app if earlier starter tables already existed.
alter table public.clients add column if not exists email text;
alter table public.clients add column if not exists phone text;
alter table public.clients add column if not exists temperature text default 'warm';
alter table public.clients add column if not exists interested_model text;
alter table public.clients add column if not exists needs text;
alter table public.clients add column if not exists general_notes text;
alter table public.clients add column if not exists updated_at timestamptz default now();

alter table public.followups add column if not exists scheduled_date date;
alter table public.followups add column if not exists scheduled_time time;
alter table public.followups add column if not exists priority text default 'normal';
alter table public.followups add column if not exists reminder_minutes integer default 60;
alter table public.followups add column if not exists purpose text;
alter table public.followups add column if not exists status text default 'scheduled';
alter table public.followups add column if not exists completed_at timestamptz;
alter table public.followups add column if not exists cancelled_at timestamptz;
alter table public.followups add column if not exists updated_at timestamptz default now();

alter table public.communications add column if not exists direction text default 'outgoing';
alter table public.communications add column if not exists channel text default 'Other';
alter table public.communications add column if not exists occurred_at timestamptz default now();
alter table public.communications add column if not exists notes text;
alter table public.communications add column if not exists client_questions text;
alter table public.communications add column if not exists agreed_next_steps text;
alter table public.communications add column if not exists transcript text;
alter table public.communications add column if not exists resulting_followup_date date;

create index if not exists clients_user_created_idx on public.clients(user_id, created_at desc);
create index if not exists clients_user_name_idx on public.clients(user_id, full_name);
create index if not exists followups_user_date_idx on public.followups(user_id, scheduled_date, scheduled_time);
create index if not exists followups_client_idx on public.followups(client_id, scheduled_date desc);
create index if not exists communications_client_idx on public.communications(client_id, occurred_at desc);

alter table public.clients enable row level security;
alter table public.followups enable row level security;
alter table public.communications enable row level security;
alter table public.client_notes enable row level security;
alter table public.quotations enable row level security;
alter table public.user_preferences enable row level security;
alter table public.push_subscriptions enable row level security;

-- Recreate policies to keep this a single-user, per-authenticated-user workspace.
do $$
declare t text;
begin
  foreach t in array array['clients','followups','communications','client_notes','quotations','user_preferences','push_subscriptions'] loop
    execute format('drop policy if exists user_own_data on public.%I', t);
    execute format('create policy user_own_data on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Note: the app marks rescheduled/cancelled events instead of deleting them.
-- Missed-event automation and push delivery require a trusted scheduled server function.
