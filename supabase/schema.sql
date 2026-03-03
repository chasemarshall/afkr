-- MinecraftAFK Bot Management Service - Hardened multi-user schema
-- Run in Supabase SQL Editor on a fresh project.

create extension if not exists "uuid-ossp";

-- ============================================
-- 1. accounts - Microsoft-authenticated MC accounts
-- ============================================
create table if not exists accounts (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  microsoft_email text not null,
  auth_token_cache text,
  auto_reconnect boolean not null default true,
  reconnect_delay_ms integer not null default 5000 check (reconnect_delay_ms > 0),
  max_reconnect_attempts integer not null default 10 check (max_reconnect_attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, microsoft_email),
  unique (owner_user_id, id)
);

-- ============================================
-- 2. servers - Minecraft servers per owner
-- ============================================
create table if not exists servers (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  host text not null,
  port integer not null default 25565 check (port between 1 and 65535),
  version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, id)
);

-- ============================================
-- 3. account_server_config - per-account server settings
-- ============================================
create table if not exists account_server_config (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  server_id uuid not null,
  auto_connect boolean not null default false,
  join_message text,
  created_at timestamptz not null default now(),
  unique (owner_user_id, account_id, server_id),
  foreign key (owner_user_id, account_id) references accounts(owner_user_id, id) on delete cascade,
  foreign key (owner_user_id, server_id) references servers(owner_user_id, id) on delete cascade
);

-- ============================================
-- 4. scheduled_commands - commands to run on triggers
-- ============================================
create table if not exists scheduled_commands (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  server_id uuid not null,
  command text not null,
  trigger_type text not null check (trigger_type in ('delay', 'interval', 'cron', 'one_time')),
  trigger_value text not null,
  enabled boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_user_id, account_id) references accounts(owner_user_id, id) on delete cascade,
  foreign key (owner_user_id, server_id) references servers(owner_user_id, id) on delete cascade
);

-- ============================================
-- 5. bot_sessions - connection session history
-- ============================================
create table if not exists bot_sessions (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  server_id uuid not null,
  connected_at timestamptz not null default now(),
  disconnected_at timestamptz,
  disconnect_reason text,
  foreign key (owner_user_id, account_id) references accounts(owner_user_id, id) on delete cascade,
  foreign key (owner_user_id, server_id) references servers(owner_user_id, id) on delete cascade
);

-- ============================================
-- 6. command_history - log of all executed commands
-- ============================================
create table if not exists command_history (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  server_id uuid not null,
  command text not null,
  source text not null check (source in ('manual', 'scheduled')),
  scheduled_command_id uuid references scheduled_commands(id) on delete set null,
  executed_at timestamptz not null default now(),
  response text,
  foreign key (owner_user_id, account_id) references accounts(owner_user_id, id) on delete cascade,
  foreign key (owner_user_id, server_id) references servers(owner_user_id, id) on delete cascade
);

-- ============================================
-- 7. scripts - automation scripts per account/server
-- ============================================
create table if not exists scripts (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null,
  server_id uuid not null,
  name text not null check (char_length(name) <= 64),
  description text check (char_length(description) <= 256),
  steps jsonb not null default '[]',
  enabled boolean not null default true,
  trigger_type text check (trigger_type in ('manual', 'interval', 'cron')),
  trigger_value text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (owner_user_id, account_id) references accounts(owner_user_id, id) on delete cascade,
  foreign key (owner_user_id, server_id) references servers(owner_user_id, id) on delete cascade
);

-- ============================================
-- Indexes for common queries
-- ============================================
create index if not exists idx_accounts_owner on accounts(owner_user_id);
create index if not exists idx_servers_owner on servers(owner_user_id);
create index if not exists idx_account_server_cfg_owner on account_server_config(owner_user_id);
create index if not exists idx_scheduled_commands_owner on scheduled_commands(owner_user_id);
create index if not exists idx_scheduled_commands_enabled_owner on scheduled_commands(owner_user_id, enabled) where enabled = true;
create index if not exists idx_bot_sessions_owner on bot_sessions(owner_user_id);
create index if not exists idx_bot_sessions_active_owner on bot_sessions(owner_user_id, account_id) where disconnected_at is null;
create index if not exists idx_command_history_owner_executed on command_history(owner_user_id, executed_at desc);
create index if not exists idx_scripts_owner on scripts(owner_user_id);
create index if not exists idx_scripts_owner_account on scripts(owner_user_id, account_id);

-- ============================================
-- updated_at trigger function
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists accounts_updated_at on accounts;
create trigger accounts_updated_at
  before update on accounts
  for each row execute function update_updated_at();

drop trigger if exists servers_updated_at on servers;
create trigger servers_updated_at
  before update on servers
  for each row execute function update_updated_at();

drop trigger if exists scheduled_commands_updated_at on scheduled_commands;
create trigger scheduled_commands_updated_at
  before update on scheduled_commands
  for each row execute function update_updated_at();

drop trigger if exists scripts_updated_at on scripts;
create trigger scripts_updated_at
  before update on scripts
  for each row execute function update_updated_at();

-- ============================================
-- Row Level Security policies
-- ============================================
alter table accounts enable row level security;
alter table servers enable row level security;
alter table account_server_config enable row level security;
alter table scheduled_commands enable row level security;
alter table bot_sessions enable row level security;
alter table command_history enable row level security;
alter table scripts enable row level security;

drop policy if exists accounts_select_own on accounts;
create policy accounts_select_own on accounts
  for select using (owner_user_id = auth.uid());

drop policy if exists accounts_insert_own on accounts;
create policy accounts_insert_own on accounts
  for insert with check (owner_user_id = auth.uid());

drop policy if exists accounts_update_own on accounts;
create policy accounts_update_own on accounts
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists accounts_delete_own on accounts;
create policy accounts_delete_own on accounts
  for delete using (owner_user_id = auth.uid());

drop policy if exists servers_select_own on servers;
create policy servers_select_own on servers
  for select using (owner_user_id = auth.uid());

drop policy if exists servers_insert_own on servers;
create policy servers_insert_own on servers
  for insert with check (owner_user_id = auth.uid());

drop policy if exists servers_update_own on servers;
create policy servers_update_own on servers
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists servers_delete_own on servers;
create policy servers_delete_own on servers
  for delete using (owner_user_id = auth.uid());

drop policy if exists account_server_config_select_own on account_server_config;
create policy account_server_config_select_own on account_server_config
  for select using (owner_user_id = auth.uid());

drop policy if exists account_server_config_insert_own on account_server_config;
create policy account_server_config_insert_own on account_server_config
  for insert with check (owner_user_id = auth.uid());

drop policy if exists account_server_config_update_own on account_server_config;
create policy account_server_config_update_own on account_server_config
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists account_server_config_delete_own on account_server_config;
create policy account_server_config_delete_own on account_server_config
  for delete using (owner_user_id = auth.uid());

drop policy if exists scheduled_commands_select_own on scheduled_commands;
create policy scheduled_commands_select_own on scheduled_commands
  for select using (owner_user_id = auth.uid());

drop policy if exists scheduled_commands_insert_own on scheduled_commands;
create policy scheduled_commands_insert_own on scheduled_commands
  for insert with check (owner_user_id = auth.uid());

drop policy if exists scheduled_commands_update_own on scheduled_commands;
create policy scheduled_commands_update_own on scheduled_commands
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists scheduled_commands_delete_own on scheduled_commands;
create policy scheduled_commands_delete_own on scheduled_commands
  for delete using (owner_user_id = auth.uid());

drop policy if exists bot_sessions_select_own on bot_sessions;
create policy bot_sessions_select_own on bot_sessions
  for select using (owner_user_id = auth.uid());

drop policy if exists bot_sessions_insert_own on bot_sessions;
create policy bot_sessions_insert_own on bot_sessions
  for insert with check (owner_user_id = auth.uid());

drop policy if exists bot_sessions_update_own on bot_sessions;
create policy bot_sessions_update_own on bot_sessions
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists bot_sessions_delete_own on bot_sessions;
create policy bot_sessions_delete_own on bot_sessions
  for delete using (owner_user_id = auth.uid());

drop policy if exists command_history_select_own on command_history;
create policy command_history_select_own on command_history
  for select using (owner_user_id = auth.uid());

drop policy if exists command_history_insert_own on command_history;
create policy command_history_insert_own on command_history
  for insert with check (owner_user_id = auth.uid());

drop policy if exists command_history_update_own on command_history;
create policy command_history_update_own on command_history
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists command_history_delete_own on command_history;
create policy command_history_delete_own on command_history
  for delete using (owner_user_id = auth.uid());

drop policy if exists scripts_select_own on scripts;
create policy scripts_select_own on scripts
  for select using (owner_user_id = auth.uid());

drop policy if exists scripts_insert_own on scripts;
create policy scripts_insert_own on scripts
  for insert with check (owner_user_id = auth.uid());

drop policy if exists scripts_update_own on scripts;
create policy scripts_update_own on scripts
  for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists scripts_delete_own on scripts;
create policy scripts_delete_own on scripts
  for delete using (owner_user_id = auth.uid());
