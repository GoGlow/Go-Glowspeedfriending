-- Run this in Supabase SQL Editor — replaces any earlier version
-- Identity model: no email login. Guest picks their name from the
-- pre-loaded ticket list, gets a random device token stored in
-- localStorage, and that token is their identity for the session.

-- ── GUESTS (imported from Ticket Tailor) ──
create table if not exists guests (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null,
  name        text not null,
  email       text,
  insta       text,
  claimed_by  text,              -- device token of whoever selected this name, null = unclaimed
  created_at  timestamptz default now(),
  unique (event_id, email)
);

alter table guests enable row level security;

create policy "guests: public read"
  on guests for select using (true);

create policy "guests: public insert"
  on guests for insert with check (true);

create policy "guests: public update"
  on guests for update using (true);

create policy "guests: public delete"
  on guests for delete using (true);

-- ── SUBMISSIONS ──
create table if not exists submissions (
  id            uuid primary key default gen_random_uuid(),
  event_id      text not null,
  guest_id      uuid references guests(id) on delete cascade,
  device_token  text not null,
  selected_ids  uuid[] default '{}',
  submitted_at  timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (event_id, guest_id)
);

alter table submissions enable row level security;

create policy "submissions: public insert"
  on submissions for insert with check (true);

create policy "submissions: public update"
  on submissions for update using (true);

create policy "submissions: public read"
  on submissions for select using (true);

-- ── REALTIME ──
alter publication supabase_realtime add table guests;
alter publication supabase_realtime add table submissions;
