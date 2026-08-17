-- Run this in Supabase SQL Editor (Dashboard → SQL → New query)

-- Table for saved generations
create table if not exists public.generations (
  id uuid default gen_random_uuid() primary key,
  original_image_url text not null,
  result_image_url text not null,
  prompt text,
  style text,
  product_name text,
  category text,
  created_at timestamptz default now()
);

alter table public.generations enable row level security;

drop policy if exists "Allow public read generations" on public.generations;
create policy "Allow public read generations"
  on public.generations for select
  using (true);

drop policy if exists "Allow public insert generations" on public.generations;
create policy "Allow public insert generations"
  on public.generations for insert
  with check (true);

-- Storage bucket for generated images (create in Dashboard → Storage if missing)
-- Bucket name: generations (public)

drop policy if exists "Public read generations bucket" on storage.objects;
create policy "Public read generations bucket"
  on storage.objects for select
  using (bucket_id = 'generations');

drop policy if exists "Anon upload generations bucket" on storage.objects;
create policy "Anon upload generations bucket"
  on storage.objects for insert
  with check (bucket_id = 'generations');
