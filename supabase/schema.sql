-- Family Tree — Supabase schema
-- Run this in Supabase SQL Editor to set up the database.

-- ============= Extensions =============
create extension if not exists "uuid-ossp";

-- ============= Tables =============

-- Families
create table if not exists public.families (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    share_code text not null unique,
    created_at timestamptz not null default now()
);

-- Family members (junction: user ↔ family with role)
create table if not exists public.family_members (
    user_id uuid not null references auth.users(id) on delete cascade,
    family_id uuid not null references public.families(id) on delete cascade,
    role text not null default 'editor' check (role in ('owner', 'editor')),
    created_at timestamptz not null default now(),
    primary key (user_id, family_id)
);

-- Persons
create table if not exists public.persons (
    id uuid primary key default uuid_generate_v4(),
    family_id uuid not null references public.families(id) on delete cascade,
    first_name text not null,
    last_name text,
    birth_year int,
    death_year int,
    gender text not null default 'other' check (gender in ('male', 'female', 'other')),
    avatar_colors text[] not null default array['#6366f1', '#8b5cf6'],
    occupation text,
    birth_place text,
    photo_url text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists idx_persons_family_id on public.persons(family_id);

-- Family units (couples + their children)
create table if not exists public.family_units (
    id uuid primary key default uuid_generate_v4(),
    family_id uuid not null references public.families(id) on delete cascade,
    partner1_id uuid not null references public.persons(id) on delete cascade,
    partner2_id uuid references public.persons(id) on delete set null,
    children_ids uuid[] not null default array[]::uuid[],
    marriage_year int,
    created_at timestamptz not null default now()
);
create index if not exists idx_family_units_family_id on public.family_units(family_id);

-- Timeline events
create table if not exists public.timeline_events (
    id uuid primary key default uuid_generate_v4(),
    family_id uuid not null references public.families(id) on delete cascade,
    year int not null,
    title text not null,
    description text,
    photo_url text,
    person_ids uuid[] not null default array[]::uuid[],
    icon text not null default 'milestone',
    color text not null default '#eab308',
    created_at timestamptz not null default now()
);
create index if not exists idx_timeline_events_family_id on public.timeline_events(family_id);

-- ============= Helper: is_family_member =============
create or replace function public.is_family_member(fam_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.family_members
        where family_id = fam_id and user_id = auth.uid()
    );
$$;

-- ============= Trigger: auto-add family creator as owner =============
create or replace function public.handle_new_family_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.family_members (user_id, family_id, role)
    values (auth.uid(), new.id, 'owner')
    on conflict do nothing;
    return new;
end;
$$;

drop trigger if exists on_family_created on public.families;
create trigger on_family_created
    after insert on public.families
    for each row execute function public.handle_new_family_owner();

-- ============= Row Level Security =============
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.persons enable row level security;
alter table public.family_units enable row level security;
alter table public.timeline_events enable row level security;

-- Families: a user can see/update/delete families they're a member of
create policy "families_select_member" on public.families
    for select using (public.is_family_member(id));
create policy "families_insert_authenticated" on public.families
    for insert to authenticated with check (auth.uid() is not null);
create policy "families_update_member" on public.families
    for update using (public.is_family_member(id));
create policy "families_delete_owner" on public.families
    for delete using (
        exists (
            select 1 from public.family_members
            where family_id = id and user_id = auth.uid() and role = 'owner'
        )
    );

-- Family members: visible to all members of the same family
create policy "members_select_member" on public.family_members
    for select using (public.is_family_member(family_id));
create policy "members_insert_self_or_member" on public.family_members
    for insert to authenticated with check (
        user_id = auth.uid() and public.is_family_member(family_id)
        -- OR a current member is adding the user (handled via join code flow on client)
    );
create policy "members_delete_self_or_owner" on public.family_members
    for delete using (
        user_id = auth.uid()
        or exists (
            select 1 from public.family_members m
            where m.family_id = family_members.family_id
              and m.user_id = auth.uid()
              and m.role = 'owner'
        )
    );

-- Persons
create policy "persons_select_member" on public.persons
    for select using (public.is_family_member(family_id));
create policy "persons_insert_member" on public.persons
    for insert with check (public.is_family_member(family_id));
create policy "persons_update_member" on public.persons
    for update using (public.is_family_member(family_id));
create policy "persons_delete_member" on public.persons
    for delete using (public.is_family_member(family_id));

-- Family units
create policy "units_select_member" on public.family_units
    for select using (public.is_family_member(family_id));
create policy "units_insert_member" on public.family_units
    for insert with check (public.is_family_member(family_id));
create policy "units_update_member" on public.family_units
    for update using (public.is_family_member(family_id));
create policy "units_delete_member" on public.family_units
    for delete using (public.is_family_member(family_id));

-- Timeline events
create policy "events_select_member" on public.timeline_events
    for select using (public.is_family_member(family_id));
create policy "events_insert_member" on public.timeline_events
    for insert with check (public.is_family_member(family_id));
create policy "events_update_member" on public.timeline_events
    for update using (public.is_family_member(family_id));
create policy "events_delete_member" on public.timeline_events
    for delete using (public.is_family_member(family_id));

-- ============= Storage bucket: photos =============
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- Storage policies: public read, authenticated write for family members
create policy "photos_public_read" on storage.objects
    for select using (bucket_id = 'photos');

create policy "photos_authenticated_insert" on storage.objects
    for insert to authenticated with check (bucket_id = 'photos');

create policy "photos_authenticated_update" on storage.objects
    for update to authenticated using (bucket_id = 'photos');

create policy "photos_authenticated_delete" on storage.objects
    for delete to authenticated using (bucket_id = 'photos');

-- ============= Realtime =============
-- Publish changes for these tables to the realtime cluster.
-- (Supabase auto-detects, but you may also explicitly add them via the dashboard:
--  Database → Replication → enable tables: persons, family_units, timeline_events, families)
alter publication supabase_realtime add table public.persons;
alter publication supabase_realtime add table public.family_units;
alter publication supabase_realtime add table public.timeline_events;
alter publication supabase_realtime add table public.families;

-- ============= Updated_at trigger for persons =============
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists on_person_updated on public.persons;
create trigger on_person_updated
    before update on public.persons
    for each row execute function public.touch_updated_at();
