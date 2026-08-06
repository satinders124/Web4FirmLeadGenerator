-- Web4Firm Lead Generator CRM schema
-- Run this in Supabase: SQL Editor → New query → Run.

create extension if not exists "pgcrypto";

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  google_place_id text unique not null,
  business_name text not null,
  category text,
  address text,
  phone text,
  rating numeric,
  review_count integer default 0,
  website_url text,
  maps_url text,
  latitude numeric,
  longitude numeric,
  lead_score integer default 0,
  opportunity_type text check (opportunity_type in ('new_website', 'website_redesign')) default 'new_website',
  status text check (status in ('new', 'proposal_ready', 'contacted', 'delivered', 'replied', 'qualified', 'won', 'lost', 'bounced')) default 'new',
  notes text,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  model text,
  opportunity_type text check (opportunity_type in ('new website', 'website redesign')),
  headline text,
  summary text,
  website_plan jsonb not null default '{}'::jsonb,
  email_subject text,
  email_html text,
  email_text text,
  sms_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.outreach_emails (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  recipient_email text not null,
  subject text not null,
  body_html text,
  provider_message_id text unique,
  status text check (status in ('draft', 'sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'failed')) default 'draft',
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.outreach_events (
  id uuid primary key default gen_random_uuid(),
  outreach_email_id uuid references public.outreach_emails(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.outreach_sms (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  recipient_phone text not null,
  body_text text not null,
  status text check (status in ('draft', 'opened', 'sent', 'failed')) default 'draft',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.website_audits (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  source_url text,
  audit_type text check (audit_type in ('no_website', 'website_review')) not null,
  opportunity_score integer,
  technical_facts jsonb not null default '{}'::jsonb,
  headline text,
  summary text,
  strengths jsonb not null default '[]'::jsonb,
  opportunities jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb,
  model text,
  created_at timestamptz not null default now()
);

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  outreach_email_id uuid references public.outreach_emails(id) on delete cascade,
  recipient_email text not null,
  step integer not null,
  channel text check (channel in ('email', 'sms')) default 'email',
  subject text,
  body_text text not null,
  due_at timestamptz not null,
  status text check (status in ('pending', 'sent', 'skipped')) default 'pending',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.website_previews (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  slug text unique not null,
  preview_content jsonb not null default '{}'::jsonb,
  status text check (status in ('draft', 'shared', 'archived')) default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inbound_replies (
  id uuid primary key default gen_random_uuid(),
  provider_message_id text unique,
  lead_id uuid references public.leads(id) on delete cascade,
  outreach_email_id uuid references public.outreach_emails(id) on delete cascade,
  from_email text,
  subject text,
  body_text text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

drop trigger if exists website_previews_set_updated_at on public.website_previews;
create trigger website_previews_set_updated_at
before update on public.website_previews
for each row execute function public.set_updated_at();

alter table public.inbound_replies add column if not exists provider_message_id text;
alter table public.proposals add column if not exists sms_text text;
create unique index if not exists inbound_replies_provider_message_idx on public.inbound_replies(provider_message_id);

create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists outreach_lead_idx on public.outreach_emails(lead_id);
create index if not exists outreach_provider_idx on public.outreach_emails(provider_message_id);
create index if not exists outreach_sms_lead_idx on public.outreach_sms(lead_id);
create index if not exists audits_lead_idx on public.website_audits(lead_id);
create index if not exists followups_due_idx on public.follow_ups(status, due_at);
create index if not exists previews_lead_idx on public.website_previews(lead_id);
create index if not exists replies_lead_idx on public.inbound_replies(lead_id);

-- The application uses the Supabase service role key only from server-side Next.js API routes.
-- Keep RLS enabled; do not expose the service role key to the browser.
alter table public.leads enable row level security;
alter table public.proposals enable row level security;
alter table public.outreach_emails enable row level security;
alter table public.outreach_events enable row level security;
alter table public.outreach_sms enable row level security;
alter table public.website_audits enable row level security;
alter table public.follow_ups enable row level security;
alter table public.website_previews enable row level security;
alter table public.inbound_replies enable row level security;
