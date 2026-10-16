-- Re-assert client RPC grants after security migration drift (dev regression 2026-10-16).

GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_simplified_inputs(UUID) TO authenticated;

GRANT EXECUTE ON FUNCTION public.create_expense_with_splits(
    uuid, text, numeric, text, text, date, text, uuid, text, jsonb
) TO authenticated;
