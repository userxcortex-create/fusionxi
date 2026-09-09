-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default 'New chat',
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references chats(id) on delete cascade not null,
  role text not null check (role in ('user','bot')),
  text text,
  image text,
  created_at timestamptz not null default now()
);

alter table chats enable row level security;
alter table messages enable row level security;

-- Each user can only see/edit their own chats.
create policy "Users manage own chats" on chats
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Each user can only see/edit messages that belong to their own chats.
create policy "Users manage own messages" on messages
  for all
  using (exists (select 1 from chats where chats.id = messages.chat_id and chats.user_id = auth.uid()))
  with check (exists (select 1 from chats where chats.id = messages.chat_id and chats.user_id = auth.uid()));

create index if not exists messages_chat_id_idx on messages (chat_id);
create index if not exists chats_user_id_idx on chats (user_id);
