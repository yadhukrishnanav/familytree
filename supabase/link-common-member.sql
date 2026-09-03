-- Linked families: anchor each link to the COMMON MEMBER shared by both trees
--
-- Question this answers: should a link require a common member present in
-- BOTH families, so the families connect through an exact route (person ↔
-- person) instead of a blind family-to-family edge? Yes — that anchor records
-- THROUGH WHOM the families are related (e.g., the daughter who married into
-- the other tree) and lets the UI draw the link precisely.
--
-- Model: family_links.member_a = a person row in family_a's tree,
--        family_links.member_b = the SAME real person in family_b's tree.
-- Both set or both null (pair constraint), and a trigger validates that each
-- member actually belongs to its side's family (correct configuration).
--
-- ▶ Run in the Supabase SQL Editor once. Safe to re-run.

alter table public.family_links
    add column if not exists member_a uuid references public.persons(id) on delete set null;
alter table public.family_links
    add column if not exists member_b uuid references public.persons(id) on delete set null;

-- Both anchors or neither.
alter table public.family_links
    drop constraint if exists link_members_paired;
alter table public.family_links
    add constraint link_members_paired
    check ((member_a is null) = (member_b is null)) not valid;
alter table public.family_links
    validate constraint link_members_paired;

-- Correct configuration: member_a must live in family_a's tree and member_b
-- in family_b's tree (and the two must not be the same row).
create or replace function public.validate_link_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if new.member_a is not null and not exists (
        select 1 from public.persons p
        where p.id = new.member_a and p.family_id = new.family_a
    ) then
        raise exception 'member_a must be a person in family_a';
    end if;
    if new.member_b is not null and not exists (
        select 1 from public.persons p
        where p.id = new.member_b and p.family_id = new.family_b
    ) then
        raise exception 'member_b must be a person in family_b';
    end if;
    if new.member_a is not null and new.member_a = new.member_b then
        raise exception 'member_a and member_b must be the two tree representations of the same person, not the same row';
    end if;
    -- Reject reverse-direction duplicates: unique_pair is an ordered
    -- constraint, so (B,A) would otherwise coexist with (A,B).
    if exists (
        select 1 from public.family_links l2
        where l2.family_a = new.family_b and l2.family_b = new.family_a
    ) then
        raise exception 'These families are already linked (reverse direction)';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_validate_link_members on public.family_links;
create trigger trg_validate_link_members
    before insert or update on public.family_links
    for each row execute function public.validate_link_members();

-- Either side's admin/owner can complete or correct the member anchors.
create policy "links_update_admin" on public.family_links
    for update to authenticated
    using (
        (public.is_family_member(family_a) or public.is_family_member(family_b))
        and exists (
            select 1 from public.family_members m
            where (m.family_id = family_a or m.family_id = family_b)
              and m.user_id = auth.uid() and m.role in ('admin', 'owner')
        )
    )
    with check (
        (public.is_family_member(family_a) or public.is_family_member(family_b))
        and exists (
            select 1 from public.family_members m
            where (m.family_id = family_a or m.family_id = family_b)
              and m.user_id = auth.uid() and m.role in ('admin', 'owner')
        )
    );
