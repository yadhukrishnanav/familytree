-- Quick fix: create missing RLS policies
-- Run this in Supabase SQL Editor if family creation fails with
-- "violates row-level security policy"

-- Drop existing policies first (safe — they'll be recreated)
drop policy if exists "families_select_member" on public.families;
drop policy if exists "families_insert_authenticated" on public.families;
drop policy if exists "families_update_member" on public.families;
drop policy if exists "families_delete_owner" on public.families;

drop policy if exists "members_select_member" on public.family_members;
drop policy if exists "members_insert_self_or_member" on public.family_members;
drop policy if exists "members_delete_self_or_owner" on public.family_members;

drop policy if exists "persons_select_member" on public.persons;
drop policy if exists "persons_insert_member" on public.persons;
drop policy if exists "persons_update_member" on public.persons;
drop policy if exists "persons_delete_member" on public.persons;

drop policy if exists "units_select_member" on public.family_units;
drop policy if exists "units_insert_member" on public.family_units;
drop policy if exists "units_update_member" on public.family_units;
drop policy if exists "units_delete_member" on public.family_units;

drop policy if exists "events_select_member" on public.timeline_events;
drop policy if exists "events_insert_member" on public.timeline_events;
drop policy if exists "events_update_member" on public.timeline_events;
drop policy if exists "events_delete_member" on public.timeline_events;

drop policy if exists "activity_select_member" on public.activity_log;
drop policy if exists "activity_insert_member" on public.activity_log;
drop policy if exists "activity_delete_admin" on public.activity_log;

drop policy if exists "chat_select_member" on public.chat_messages;
drop policy if exists "chat_insert_member" on public.chat_messages;
drop policy if exists "chat_delete_own_or_admin" on public.chat_messages;

drop policy if exists "links_select_member" on public.family_links;
drop policy if exists "links_insert_admin" on public.family_links;
drop policy if exists "links_delete_admin" on public.family_links;

-- Recreate all policies
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
            where family_id = id and user_id = auth.uid() and role in ('admin', 'owner')
        )
    );

create policy "members_select_member" on public.family_members
    for select using (public.is_family_member(family_id));
create policy "members_insert_self_or_member" on public.family_members
    for insert to authenticated with check (
        user_id = auth.uid()
    );
create policy "members_delete_self_or_owner" on public.family_members
    for delete using (
        user_id = auth.uid()
        or exists (
            select 1 from public.family_members m
            where m.family_id = family_members.family_id
              and m.user_id = auth.uid()
              and m.role in ('admin', 'owner')
        )
    );

create policy "persons_select_member" on public.persons
    for select using (public.is_family_member(family_id));
create policy "persons_insert_member" on public.persons
    for insert with check (public.is_family_member(family_id));
create policy "persons_update_member" on public.persons
    for update using (public.is_family_member(family_id));
create policy "persons_delete_member" on public.persons
    for delete using (public.is_family_member(family_id));

create policy "units_select_member" on public.family_units
    for select using (public.is_family_member(family_id));
create policy "units_insert_member" on public.family_units
    for insert with check (public.is_family_member(family_id));
create policy "units_update_member" on public.family_units
    for update using (public.is_family_member(family_id));
create policy "units_delete_member" on public.family_units
    for delete using (public.is_family_member(family_id));

create policy "events_select_member" on public.timeline_events
    for select using (public.is_family_member(family_id));
create policy "events_insert_member" on public.timeline_events
    for insert with check (public.is_family_member(family_id));
create policy "events_update_member" on public.timeline_events
    for update using (public.is_family_member(family_id));
create policy "events_delete_member" on public.timeline_events
    for delete using (public.is_family_member(family_id));

create policy "activity_select_member" on public.activity_log
    for select using (public.is_family_member(family_id));
create policy "activity_insert_member" on public.activity_log
    for insert to authenticated with check (public.is_family_member(family_id));
create policy "activity_delete_admin" on public.activity_log
    for delete using (
        exists (
            select 1 from public.family_members m
            where m.family_id = activity_log.family_id
              and m.user_id = auth.uid()
              and m.role in ('admin','owner')
        )
    );

create policy "chat_select_member" on public.chat_messages
    for select using (public.is_family_member(family_id));
create policy "chat_insert_member" on public.chat_messages
    for insert to authenticated with check (public.is_family_member(family_id) and user_id = auth.uid());
create policy "chat_delete_own_or_admin" on public.chat_messages
    for delete using (
        user_id = auth.uid()
        or exists (
            select 1 from public.family_members m
            where m.family_id = chat_messages.family_id
              and m.user_id = auth.uid()
              and m.role in ('admin', 'owner')
        )
    );

create policy "links_select_member" on public.family_links
    for select using (
        public.is_family_member(family_a) or public.is_family_member(family_b)
    );
create policy "links_insert_admin" on public.family_links
    for insert to authenticated with check (
        public.is_family_member(family_a) and exists (
            select 1 from public.family_members m
            where m.family_id = family_a and m.user_id = auth.uid() and m.role in ('admin', 'owner')
        )
    );
create policy "links_delete_admin" on public.family_links
    for delete using (
        (public.is_family_member(family_a) or public.is_family_member(family_b))
        and exists (
            select 1 from public.family_members m
            where (m.family_id = family_a or m.family_id = family_b)
              and m.user_id = auth.uid()
              and m.role in ('admin', 'owner')
        )
    );

-- Also fix the trigger to use 'admin' role instead of 'owner'
create or replace function public.handle_new_family_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    insert into public.family_members (user_id, family_id, role)
    values (auth.uid(), new.id, 'admin')
    on conflict do nothing;
    return new;
end;
$$;
