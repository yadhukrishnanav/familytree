-- Fix: let the canvas show a read-only "ghost" preview of LINKED families.
--
-- persons / family_units RLS only allows DIRECT members to read rows, so a
-- member of family A linked to family B cannot load B's tree — the canvas
-- ghost view silently fails.
--
-- This patch adds get_linked_family_tree(uuid): a security-definer RPC that
-- verifies the caller is a member of the requested family or of any family
-- linked to it (family_links), then returns that family's persons +
-- family_units as JSON. Read-only.
--
-- ▶ Run this in the Supabase SQL Editor (or `psql`) once. Safe to re-run
--   (CREATE OR REPLACE). supabase/schema.sql contains the same function for
--   fresh installs. Until this runs, linked-family chips still appear and
--   switching still works, but the ghost preview is hidden.
--
-- Column-qualification note: every column is qualified (p./u./l.) — the
-- RETURNS TABLE output variables (persons, family_units) must never collide
-- with unqualified column names (same class of bug as the
-- 'column reference "share_code" is ambiguous' fix in join_family_by_code).

create or replace function public.get_linked_family_tree(p_family_id uuid)
returns table (persons jsonb, family_units jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Caller must be a member of p_family_id itself, or of any family
    -- linked to it via family_links.
    if not (
        public.is_family_member(p_family_id)
        or exists (
            select 1
            from public.family_links l
            where (l.family_a = p_family_id and public.is_family_member(l.family_b))
               or (l.family_b = p_family_id and public.is_family_member(l.family_a))
        )
    ) then
        raise exception 'Not a member of a linked family';
    end if;

    return query
    select
        (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb)
         from public.persons p
         where p.family_id = p_family_id),
        (select coalesce(jsonb_agg(to_jsonb(u)), '[]'::jsonb)
         from public.family_units u
         where u.family_id = p_family_id);
end;
$$;

grant execute on function public.get_linked_family_tree(uuid) to authenticated;
