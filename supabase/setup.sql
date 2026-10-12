-- ════════════════════════════════════════════════════════════════
--  Our Little Frame – SIMPLE setup (no logins)
--  Supabase → SQL Editor → New query → paste this → Run.  Done.
--  Anyone with your site link can read and write the frame.
-- ════════════════════════════════════════════════════════════════
create table public.settings (
  id int primary key default 1 check (id = 1),
  greeting text not null default 'Happy 23rd Birthday, My Love ♡',
  subtitle text not null default 'A little collection of everything we''ve been, everything we are, and everything we''re going to be.',
  letter text not null default '',
  future_letter text not null default '',
  reunion_label text not null default '',
  reunion_date date,
  updated_at timestamptz not null default now()
);
insert into public.settings (id, letter) values (1,
  E'I wish I could put every hug, every memory, every little moment with you into a box. So I made you this instead. A little world of our own, filled with moments we''ve already lived and moments we''re still waiting for.\n\nSome are ready to be opened. Some need a little more time. And some haven''t even been imagined yet.\n\nHappy birthday, my favourite person. Here''s to everything that''s still waiting for us. ♡');

create table public.categories (id uuid primary key default gen_random_uuid(), title text not null, subtitle text not null default '', sort int not null default 0);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories on delete set null,
  title text not null, hint text not null default '', icon text not null default '💌',
  kind text not null default 'letter',
  unlock_mode text not null default 'manual',
  target_date date, unlocked boolean not null default false,
  secret_compartment boolean not null default false, archived boolean not null default false,
  sort int not null default 0, revealed_at timestamptz, revealed_by text,
  created_at timestamptz not null default now()
);

create table public.milestone_secrets (
  milestone_id uuid primary key references public.milestones on delete cascade,
  message text not null default '', caption text not null default '',
  image_path text,                      -- photos are stored right here as small data-URLs
  activity jsonb not null default '{}'
);

create table public.notes (id uuid primary key default gen_random_uuid(), kind text not null check (kind in ('love_note','date_idea')), body text not null, created_at timestamptz not null default now());
create table public.guestbook (id uuid primary key default gen_random_uuid(), author_name text not null default '', body text not null check (char_length(body) between 1 and 600), created_at timestamptz not null default now());

-- open access for anyone holding the site link
do $$ declare t text; begin
  foreach t in array array['settings','categories','milestones','milestone_secrets','notes','guestbook'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "open access" on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- live sync between your two phones
alter publication supabase_realtime add table public.milestones, public.notes, public.guestbook, public.settings, public.categories;
