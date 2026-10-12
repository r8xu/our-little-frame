-- ════════════════════════════════════════════════════════════════
--  Our Little Frame – database, security rules and storage
--  Run this ONCE in Supabase → SQL Editor → New query → Run.
--  (Safe to re-run on a fresh project; it is not meant for upgrades.)
-- ════════════════════════════════════════════════════════════════

-- 1. Who is allowed in ───────────────────────────────────────────
create table public.members (
  user_id      uuid primary key references auth.users on delete cascade,
  role         text not null check (role in ('admin','partner')),
  display_name text not null default ''
);

create function public.is_member() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.members where user_id = auth.uid()) $$;

create function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.members where user_id = auth.uid() and role = 'admin') $$;

-- 2. Content tables ──────────────────────────────────────────────
create table public.settings (
  id            int primary key default 1 check (id = 1),
  greeting      text not null default 'Happy 23rd Birthday, My Love ♡',
  subtitle      text not null default 'A little collection of everything we''ve been, everything we are, and everything we''re going to be.',
  letter        text not null default '',
  future_letter text not null default '',
  reunion_label text not null default '',
  reunion_date  date,
  updated_at    timestamptz not null default now()
);
insert into public.settings (id, letter) values (1,
  E'I wish I could put every hug, every memory, every little moment with you into a box. So I made you this instead. A little world of our own, filled with moments we''ve already lived and moments we''re still waiting for.\n\nSome are ready to be opened. Some need a little more time. And some haven''t even been imagined yet.\n\nHappy birthday, my favourite person. Here''s to everything that''s still waiting for us. ♡');

create table public.categories (
  id       uuid primary key default gen_random_uuid(),
  title    text not null,
  subtitle text not null default '',
  sort     int  not null default 0
);

create table public.milestones (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid references public.categories on delete set null,
  title              text not null,
  hint               text not null default '',
  icon               text not null default '💌',
  kind               text not null default 'letter'
                     check (kind in ('letter','photo','memory','promise','choice','coupon','typewriter','capsule')),
  unlock_mode        text not null default 'manual'
                     check (unlock_mode in ('birthday','date','manual','sealed','future')),
  target_date        date,
  unlocked           boolean not null default false,   -- the manual "she can open it now" switch
  secret_compartment boolean not null default false,   -- hidden from her entirely until it is open
  archived           boolean not null default false,
  sort               int not null default 0,
  revealed_at        timestamptz,
  revealed_by        uuid references auth.users,
  created_at         timestamptz not null default now()
);

-- The private part (letters, photos, activities) lives in its own table
-- so it can be locked away until the milestone is open.
create table public.milestone_secrets (
  milestone_id uuid primary key references public.milestones on delete cascade,
  message      text  not null default '',
  caption      text  not null default '',
  image_path   text,
  activity     jsonb not null default '{}'
);

create table public.notes (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('love_note','date_idea')),
  body       text not null,
  created_at timestamptz not null default now()
);

create table public.guestbook (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references auth.users default auth.uid(),
  author_name text not null default '',
  body        text not null check (char_length(body) between 1 and 600),
  created_at  timestamptz not null default now()
);

-- 3. The unlock rule (the SERVER decides, not the browser) ───────
create function public.milestone_is_open(mid uuid) returns boolean
  language sql stable security definer set search_path = public as
$$
  select exists (
    select 1 from public.milestones m
    where m.id = mid and not m.archived and (
      m.unlocked
      or m.unlock_mode = 'birthday'
      or (m.unlock_mode = 'date' and m.target_date is not null
          and m.target_date <= (now() at time zone 'utc')::date)
    )
  )
$$;

-- Opening a milestone: the only thing she is allowed to change.
create function public.reveal_milestone(mid uuid) returns void
  language plpgsql security definer set search_path = public as
$$
begin
  if not public.is_member() then raise exception 'not allowed'; end if;
  if not public.milestone_is_open(mid) then raise exception 'This one is still sealed ♡'; end if;
  update public.milestones
     set revealed_at = coalesce(revealed_at, now()),
         revealed_by = coalesce(revealed_by, auth.uid())
   where id = mid;
end
$$;

revoke execute on function public.is_member(), public.is_admin(),
  public.milestone_is_open(uuid), public.reveal_milestone(uuid) from public, anon;
grant  execute on function public.is_member(), public.is_admin(),
  public.milestone_is_open(uuid), public.reveal_milestone(uuid) to authenticated;

-- 4. Row-level security ──────────────────────────────────────────
alter table public.members           enable row level security;
alter table public.settings          enable row level security;
alter table public.categories        enable row level security;
alter table public.milestones        enable row level security;
alter table public.milestone_secrets enable row level security;
alter table public.notes             enable row level security;
alter table public.guestbook         enable row level security;

-- members: you can see your own row; nobody can change membership from the app
create policy "see own membership" on public.members for select to authenticated using (user_id = auth.uid());

-- settings / categories / notes: both read, only admin writes
create policy "read settings"   on public.settings   for select to authenticated using (public.is_member());
create policy "admin settings"  on public.settings   for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read categories" on public.categories for select to authenticated using (public.is_member());
create policy "admin categories" on public.categories for all   to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "read notes"      on public.notes      for select to authenticated using (public.is_member());
create policy "admin notes"     on public.notes      for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- milestones: admin sees everything. Partner sees non-archived ones,
-- and secret compartments only once they are open.
create policy "read milestones" on public.milestones for select to authenticated using (
  public.is_admin()
  or (public.is_member() and not archived
      and (not secret_compartment or public.milestone_is_open(id)))
);
create policy "admin milestones" on public.milestones for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- secrets: partner can read ONLY the secrets of milestones that are open
create policy "read open secrets" on public.milestone_secrets for select to authenticated using (
  public.is_admin() or (public.is_member() and public.milestone_is_open(milestone_id))
);
create policy "admin secrets" on public.milestone_secrets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- guestbook: both read and write their own; admin can tidy up
create policy "read guestbook"  on public.guestbook for select to authenticated using (public.is_member());
create policy "write guestbook" on public.guestbook for insert to authenticated
  with check (public.is_member() and author_id = auth.uid());
create policy "delete guestbook" on public.guestbook for delete to authenticated
  using (public.is_admin() or author_id = auth.uid());

-- 5. Private photo storage ───────────────────────────────────────
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
  on conflict (id) do nothing;

create policy "admin manages photos" on storage.objects for all to authenticated
  using (bucket_id = 'photos' and public.is_admin())
  with check (bucket_id = 'photos' and public.is_admin());

-- she can only fetch a photo that belongs to a milestone that is already open
create policy "partner reads open photos" on storage.objects for select to authenticated using (
  bucket_id = 'photos' and public.is_member() and exists (
    select 1 from public.milestone_secrets s
    where s.image_path = storage.objects.name and public.milestone_is_open(s.milestone_id)
  )
);

-- 6. Live sync between your two phones ───────────────────────────
alter publication supabase_realtime add table
  public.milestones, public.notes, public.guestbook, public.settings, public.categories;

-- ════════════════════════════════════════════════════════════════
--  NEXT (after creating the two users in Authentication → Users):
--  replace the two emails and run these two lines:
--
--  insert into public.members (user_id, role, display_name)
--    select id, 'admin',   'Me'  from auth.users where email = 'YOUR_EMAIL@example.com';
--  insert into public.members (user_id, role, display_name)
--    select id, 'partner', 'Her' from auth.users where email = 'HER_EMAIL@example.com';
-- ════════════════════════════════════════════════════════════════
