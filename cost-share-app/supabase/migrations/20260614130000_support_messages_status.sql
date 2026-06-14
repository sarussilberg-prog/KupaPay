alter table public.support_messages
    add column status text not null default 'open'
        check (status in ('open', 'closed'));

-- Update RPC to include status and sort open first
drop function if exists public.admin_list_support_messages();
create or replace function public.admin_list_support_messages()
returns table (
    id          uuid,
    name        text,
    email       text,
    message     text,
    status      text,
    created_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
    select id, name, email, message, status, created_at
    from public.support_messages
    order by
        case when status = 'open' then 0 else 1 end,
        created_at desc;
$$;

-- RPC for admin to update status
create or replace function public.admin_update_support_message_status(
    p_id     uuid,
    p_status text
)
returns void
language sql
security definer
set search_path = public
as $$
    update public.support_messages
    set status = p_status
    where id = p_id;
$$;
