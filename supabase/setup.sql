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

-- Existing projects created this table before product_name/category existed.
-- CREATE TABLE IF NOT EXISTS will not add those columns, so alter explicitly.
alter table public.generations
  add column if not exists product_name text,
  add column if not exists category text;

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

-- User credit balances for Stripe Checkout
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  credits integer not null default 20,
  updated_at timestamptz default now()
);

alter table public.profiles
  add column if not exists updated_at timestamptz default now();

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create table if not exists public.credit_purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text not null unique,
  credits integer not null,
  created_at timestamptz default now()
);

alter table public.credit_purchases enable row level security;

drop policy if exists "Users can read own credit purchases" on public.credit_purchases;
create policy "Users can read own credit purchases"
  on public.credit_purchases for select
  using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, credits)
  values (new.id, 20)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.add_profile_credits(
  p_user_id uuid,
  p_credits integer,
  p_stripe_session_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_credits <= 0 then
    raise exception 'credits must be positive';
  end if;

  begin
    insert into public.credit_purchases (user_id, stripe_session_id, credits)
    values (p_user_id, p_stripe_session_id, p_credits);
  exception
    when unique_violation then
      select credits into new_balance
      from public.profiles
      where id = p_user_id;
      return coalesce(new_balance, 0);
  end;

  insert into public.profiles (id, credits)
  values (p_user_id, p_credits)
  on conflict (id) do update
    set credits = public.profiles.credits + excluded.credits
  returning credits into new_balance;

  return new_balance;
end;
$$;

revoke all on function public.add_profile_credits(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.add_profile_credits(uuid, integer, text) to service_role;

create or replace function public.spend_credits(p_amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  update public.profiles
  set credits = credits - p_amount,
      updated_at = now()
  where id = auth.uid()
    and credits >= p_amount
  returning credits into new_balance;

  if new_balance is null then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  return new_balance;
end;
$$;

revoke all on function public.spend_credits(integer) from public, anon;
grant execute on function public.spend_credits(integer) to authenticated;

-- Connected social accounts for auto-publishing.
-- Строка существует только у подключённого аккаунта: отключение — это delete.
-- Токены платформ здесь держать нельзя — пользователь читает эту таблицу.
-- Они лежат в public.social_account_secrets ниже.
create table if not exists public.social_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  username text,
  avatar_url text,
  auto_publish boolean not null default false,
  connected_at timestamptz not null default now(),
  primary key (user_id, platform),
  constraint social_accounts_platform_check
    check (platform in ('instagram', 'facebook', 'tiktok'))
);

alter table public.social_accounts enable row level security;

drop policy if exists "Users can read own social accounts" on public.social_accounts;
create policy "Users can read own social accounts"
  on public.social_accounts for select
  using (auth.uid() = user_id);

drop policy if exists "Users can connect own social accounts" on public.social_accounts;
create policy "Users can connect own social accounts"
  on public.social_accounts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own social accounts" on public.social_accounts;
create policy "Users can update own social accounts"
  on public.social_accounts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can disconnect own social accounts" on public.social_accounts;
create policy "Users can disconnect own social accounts"
  on public.social_accounts for delete
  using (auth.uid() = user_id);

-- Объект, в который публикуем: id страницы для facebook, id профессионального
-- аккаунта Instagram для instagram. У tiktok (пока заглушка) остаётся null.
alter table public.social_accounts
  add column if not exists platform_account_id text;

-- Instagram публикуется токеном связанной страницы Facebook, поэтому её id
-- нужен отдельно — по нему видно, через какую страницу идёт постинг.
alter table public.social_accounts
  add column if not exists page_id text;

-- Access-токены платформ. RLS включён, и политик намеренно нет ни одной:
-- anon и authenticated не получат ни одной строки, читает только service_role,
-- который RLS обходит. Отключение аккаунта удаляет токен каскадом.
create table if not exists public.social_account_secrets (
  user_id uuid not null,
  platform text not null,
  access_token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, platform),
  foreign key (user_id, platform)
    references public.social_accounts(user_id, platform) on delete cascade
);

alter table public.social_account_secrets enable row level security;
revoke all on public.social_account_secrets from anon, authenticated;

-- TikTok access-токен истекает примерно через сутки, публикация без refresh
-- невозможна. У Meta поле остаётся null.
alter table public.social_account_secrets
  add column if not exists refresh_token text;

-- 3D meshes from Image to 3D (TripoSR). Bucket must be public so the viewer
-- and Fal.ai can fetch the GLB without a signed URL.
insert into storage.buckets (id, name, public)
values ('3d-models', '3d-models', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read 3d-models bucket" on storage.objects;
create policy "Public read 3d-models bucket"
  on storage.objects for select
  using (bucket_id = '3d-models');

drop policy if exists "Anon upload 3d-models bucket" on storage.objects;
create policy "Anon upload 3d-models bucket"
  on storage.objects for insert
  with check (bucket_id = '3d-models');

create table if not exists public.generated_models (
  id uuid default gen_random_uuid() primary key,
  source_image_url text not null,
  model_url text not null,
  product_name text,
  created_at timestamptz default now()
);

alter table public.generated_models enable row level security;

drop policy if exists "Allow public read generated models" on public.generated_models;
create policy "Allow public read generated models"
  on public.generated_models for select
  using (true);

drop policy if exists "Allow public insert generated models" on public.generated_models;
create policy "Allow public insert generated models"
  on public.generated_models for insert
  with check (true);
