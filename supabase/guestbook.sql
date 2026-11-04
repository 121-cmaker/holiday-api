-- Week 10 guestbook: public read; server-only write
create table if not exists public.guestbook (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 name text not null check (char_length(name) between 1 and 20),
 message text not null check (char_length(message) between 1 and 200)
);
alter table public.guestbook enable row level security;
revoke all on public.guestbook from anon, authenticated;
grant select on public.guestbook to anon, authenticated;
grant select, insert on public.guestbook to service_role;
create policy "누구나 읽기" on public.guestbook for select to anon, authenticated using (true);
-- Deliberately no anon/authenticated INSERT policy.
