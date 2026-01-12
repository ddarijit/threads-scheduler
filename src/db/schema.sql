-- Create the threads table
create table public.threads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  content text not null,
  scheduled_time timestamptz,
  status text check (status in ('draft', 'scheduled', 'published')) default 'draft',
  media_urls text[],
  first_comment text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.threads enable row level security;

-- Create Policy: Users can only see their own threads
create policy "Users can view own threads"
  on public.threads for select
  using (auth.uid() = user_id);

-- Create Policy: Users can insert their own threads
create policy "Users can insert own threads"
  on public.threads for insert
  with check (auth.uid() = user_id);

-- Create Policy: Users can update their own threads
create policy "Users can update own threads"
  on public.threads for update
  using (auth.uid() = user_id);

-- Create Policy: Users can delete their own threads
create policy "Users can delete own threads"
  on public.threads for delete
  using (auth.uid() = user_id);

-- Dashboard Query: Count threads by status (for analytics)
-- select status, count(*) from threads where user_id = auth.uid() group by status;

-- Dummy Data Insertion (Replace 'USER_ID_HERE' with your actual User UUID from Supabase Auth)
-- You can find your User UUID in the Authentication > Users section of Supabase Dashboard.
-- insert into public.threads (user_id, content, status, scheduled_time)
-- values 
--   ('USER_ID_HERE', 'Just scheduled my first thread! 🚀 #threadmaster', 'scheduled', now() + interval '1 day'),
--   ('USER_ID_HERE', 'Drafting some ideas for next week...', 'draft', null),
--   ('USER_ID_HERE', 'This is a published thread history item.', 'published', now() - interval '2 days');

-- Create user_tokens table to store Threads API credentials
create table public.user_tokens (
  user_id uuid references auth.users(id) not null primary key,
  threads_access_token text not null,
  threads_user_id text not null,
  updated_at timestamptz default now()
);

-- Enable RLS for user_tokens
alter table public.user_tokens enable row level security;

create policy "Users can manage their own tokens"
  on public.user_tokens for all
  using (auth.uid() = user_id);
