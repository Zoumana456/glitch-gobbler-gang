CREATE OR REPLACE FUNCTION app_private.is_manager_of(_manager uuid, _user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE chain AS (
    SELECT cm.id, cm.manager_id, cm.user_id, 0 AS depth
    FROM public.company_members cm
    WHERE cm.user_id = _user
    UNION ALL
    SELECT p.id, p.manager_id, p.user_id, c.depth + 1
    FROM public.company_members p
    JOIN chain c ON p.id = c.manager_id
    WHERE c.depth < 10
  )
  SELECT _manager IS NOT NULL AND _user IS NOT NULL AND _manager <> _user AND (
    EXISTS (SELECT 1 FROM chain WHERE depth > 0 AND user_id = _manager)
    OR app_private.is_dg_of_user(_manager, _user)
    OR EXISTS (
      SELECT 1
      FROM public.company_members mgr
      JOIN public.company_members tgt ON tgt.company_id = mgr.company_id
      WHERE mgr.user_id = _manager
        AND mgr.hierarchy_level = 1
        AND tgt.user_id = _user
    )
  );
$function$;

GRANT EXECUTE ON FUNCTION app_private.is_manager_of(uuid, uuid) TO authenticated, service_role;