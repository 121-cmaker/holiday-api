-- 개인 프로젝트 설계용 (11/4): 도시 날씨에 대한 방문자 후기
-- This SQL is a proposed design; do not run without reviewing it.
create table if not exists public.weather_reviews (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 nickname text not null check (char_length(nickname) between 1 and 20),
 city text not null check (char_length(city) between 2 and 60),
 review text not null check (char_length(review) between 1 and 200)
);
alter table public.weather_reviews enable row level security;
revoke all on public.weather_reviews from anon, authenticated;
grant select on public.weather_reviews to anon, authenticated;
grant select, insert on public.weather_reviews to service_role;
create policy "도시 후기 공개 읽기" on public.weather_reviews for select to anon, authenticated using (true);
-- Don't collect real names, student numbers, phones or email.
