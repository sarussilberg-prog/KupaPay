create table public.support_messages (
    id          uuid primary key default gen_random_uuid(),
    name        text not null,
    email       text not null,
    message     text not null,
    created_at  timestamptz not null default now()
);

-- Anyone can submit a support message (no auth required)
alter table public.support_messages enable row level security;

create policy "public_insert_support_messages"
    on public.support_messages
    for insert
    to anon, authenticated
    with check (true);

-- Only admins can read
create policy "admin_select_support_messages"
    on public.support_messages
    for select
    to authenticated
    using (public.is_app_admin());

-- RPC for admin to list messages
create or replace function public.admin_list_support_messages()
returns table (
    id          uuid,
    name        text,
    email       text,
    message     text,
    created_at  timestamptz
)
language sql
security definer
set search_path = public
as $$
    select id, name, email, message, created_at
    from public.support_messages
    order by created_at desc;
$$;
