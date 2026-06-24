-- ============================================================
-- Migration 008 — Single Admin Lock + Community Chat
-- PhinTech Arena | PhinTech Solutions, Kenya
-- ============================================================

-- ── LOCK ADMIN TO ONE ACCOUNT ONLY ────────────────────────────────────────────
-- Remove all current admin roles
delete from public.admin_roles;
update public.profiles set is_admin = false;

-- Set ONLY phingish@gmail.com as admin
do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'phingish@gmail.com';
  if v_uid is not null then
    update public.profiles set is_admin = true where id = v_uid;
    insert into public.admin_roles (user_id, role)
    values (v_uid, 'admin')
    on conflict (user_id) do update set role = 'admin';
    raise notice 'Admin locked to phingish@gmail.com (uid: %)', v_uid;
  else
    raise notice 'WARNING: phingish@gmail.com not found in auth.users';
  end if;
end $$;

-- Prevent multiple admins via trigger
create or replace function public.enforce_single_admin()
returns trigger language plpgsql security definer as $$
begin
  -- Only allow the designated admin email to have is_admin = true
  if NEW.is_admin = true then
    declare v_email text;
    begin
      select email into v_email from auth.users where id = NEW.id;
      if v_email <> 'phingish@gmail.com' then
        raise exception 'Only phingish@gmail.com can be admin';
      end if;
    end;
  end if;
  return NEW;
end $$;

drop trigger if exists enforce_single_admin_trigger on public.profiles;
create trigger enforce_single_admin_trigger
  before update of is_admin on public.profiles
  for each row
  when (NEW.is_admin = true and OLD.is_admin = false)
  execute procedure public.enforce_single_admin();

-- ── COMMUNITY CHAT ─────────────────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id           uuid default gen_random_uuid() primary key,
  created_at   timestamptz default now() not null,
  user_id      uuid references public.profiles(id) on delete set null,
  gamer_tag    text not null,
  avatar_url   text,
  message      text not null,
  is_admin     boolean default false,
  is_pinned    boolean default false,   -- pinned messages float to top
  message_type text  default 'chat',   -- chat | announcement | system
  reply_to     uuid references public.chat_messages(id) on delete set null,
  edited_at    timestamptz,
  deleted      boolean default false    -- soft delete
);

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────────
create table if not exists public.announcements (
  id         uuid default gen_random_uuid() primary key,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  title      text not null,
  body       text not null,
  icon       text default '📢',
  color      text default 'purple',   -- purple | red | green | amber | blue
  active     boolean default true,
  pinned     boolean default false,   -- show at very top of chat
  expires_at timestamptz              -- auto-hide after this time
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.chat_messages enable row level security;
alter table public.announcements  enable row level security;

-- Chat: anyone can read non-deleted messages
create policy "chat_public_read"
  on public.chat_messages for select
  using (deleted = false);

-- Chat: authenticated users can insert their own messages
create policy "chat_auth_insert"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

-- Chat: users can soft-delete their own; admins can delete any
create policy "chat_own_update"
  on public.chat_messages for update
  using (
    auth.uid() = user_id
    or exists(select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Announcements: public read
create policy "announcements_public_read"
  on public.announcements for select
  using (active = true and (expires_at is null or expires_at > now()));

-- Announcements: only admin can manage
create policy "announcements_admin_manage"
  on public.announcements for all
  using (exists(select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ── INDEXES ────────────────────────────────────────────────────────────────────
create index if not exists idx_chat_created    on public.chat_messages(created_at desc);
create index if not exists idx_chat_pinned     on public.chat_messages(is_pinned, created_at desc);
create index if not exists idx_announcements   on public.announcements(active, pinned, created_at desc);
