-- Linked families: anchor each link to the COMMON MEMBER shared by both trees
-- (v2 — fixes link_members_paired violation on link creation)
--
-- v1 added a CHECK requiring member_a and member_b to be both-set or both-null.
-- That contradicts the intended incremental flow: the first admin to link sets
-- only THEIR side's anchor, which is unavoidably a "half-set" row and was
-- rejected with:
--   new row for relation "family_links" violates check constraint "link_members_paired"
--
-- v2 removes the pair constraint. Anchors may be 0, 1, or 2 rows:
--   2 anchors            -> fully linked ("Linked through X")
--   only our anchor      -> "Through X (their side pending)"
--   none                 -> "Common member not set"
-- Per-side correctness is still enforced by the validate_link_members trigger
-- (each anchor must belong to its own side's family), reverse-direction
-- duplicate links stay rejected, and either side's admin can complete the
-- anchors later.
--
-- ▶ Run in the Supabase SQL Editor once (safe to re-run; also REPAIRS a DB
--   that still has the v1 constraint by dropping it).

alter table public.family_links
    add column if not exists member_a uuid references public.persons(id) on delete set null;
alter table public.family_links
    add column if not exists member_b uuid references public.persons(id) on delete set null;

-- v1 repair: the pair check blocked half-set rows (i.e. the whole flow).
alter table public.family_links
    drop constraint if exists link_members_paired;

-- Correct configuration: member_a must live in family_a's tree and member_b
-- in family_b's tree; both-set-equal-row is invalid; reverse duplicates are
-- rejected (unique_pair is ordered and would otherwise allow (B,A) beside (A,B)).
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

-- Either side's admin/owner can create, complete or correct the anchors.
drop policy if exists "links_update_admin" on public.family_links;
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
