-- Fix: join_family_by_code fails with
--   ERROR: column reference "share_code" is ambiguous
--
-- Root cause: the RETURNS TABLE clause creates PL/pgSQL output variables
-- (family_id, family_name, share_code, role). Any *unqualified* reference to
-- `share_code` (or `role`) inside the function body is then ambiguous between
-- the table column and the output variable — PL/pgSQL's default
-- variable_conflict = error rejects it at runtime.
--
-- Fix: qualify every column with a table alias (f. / fm.) so references are
-- unambiguous. No signature change — clients keep calling it the same way.
--
-- ▶ Run this in the Supabase SQL Editor (or `psql`) once. It replaces the
--   broken function in place; supabase/schema.sql contains the same fix.

create or replace function public.join_family_by_code(p_share_code text)
returns table (family_id uuid, family_name text, share_code text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
    fam record;
    existing_role text;
begin
    -- Find the family by share code (case-insensitive).
    -- f.<col> qualified: `share_code` would otherwise collide with the
    -- RETURNS TABLE output variable of the same name.
    select f.id, f.name, f.share_code into fam
    from public.families f
    where upper(f.share_code) = upper(p_share_code)
    limit 1;

    if not found then
        raise exception 'No family found with that share code';
    end if;

    -- Check if already a member (fm.role qualified — `role` is also an
    -- output variable of this function).
    select fm.role into existing_role
    from public.family_members fm
    where fm.user_id = auth.uid() and fm.family_id = fam.id
    limit 1;

    if existing_role is null then
        -- Insert new membership as 'editor'
        insert into public.family_members (user_id, family_id, role)
        values (auth.uid(), fam.id, 'editor')
        on conflict do nothing;
        existing_role := 'editor';
    end if;

    return query select fam.id, fam.name, fam.share_code, existing_role;
end;
$$;

grant execute on function public.join_family_by_code(text) to authenticated;
