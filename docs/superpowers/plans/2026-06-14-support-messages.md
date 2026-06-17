# Support Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public `/support` contact form on the web app that saves messages to Supabase, and a new "Support Messages" screen in the mobile admin portal to view them.

**Architecture:** A new `support_messages` table in Supabase accepts inserts from anyone (no auth required) and only admins can read. The web `/support` page is a Next.js Server Action form. The mobile admin portal gets a new screen following the exact same pattern as `AdminDeletedUsersScreen`.

**Tech Stack:** Next.js 15 App Router (Server Actions), React Native + NativeWind (Tailwind classes), Supabase RLS, @tanstack/react-query, react-i18next

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/20260614120000_support_messages.sql` | Create | Table + RLS + admin RPC |
| `apps/web/app/support/page.tsx` | Create | Public contact form (Server Action) |
| `apps/mobile/services/admin.service.ts` | Modify | Add `listSupportMessages()` |
| `apps/mobile/hooks/queries/keys.ts` | Modify | Add `adminSupportMessages` query key |
| `apps/mobile/hooks/queries/useAdminSupportMessagesQuery.ts` | Create | React Query hook |
| `apps/mobile/screens/admin/AdminSupportMessagesScreen.tsx` | Create | Admin screen listing messages |
| `apps/mobile/navigation/AppNavigator.tsx` | Modify | Register new screen |
| `apps/mobile/screens/admin/AdminPortalScreen.tsx` | Modify | Add row to navigate to new screen |
| `apps/mobile/i18n/locales/en.json` | Modify | Add i18n keys |
| `apps/mobile/i18n/locales/he.json` | Modify | Add Hebrew i18n keys |

---

### Task 1: Supabase migration — support_messages table

**Files:**
- Create: `supabase/migrations/20260614120000_support_messages.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260614120000_support_messages.sql

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
```

- [ ] **Step 2: Apply the migration to local Supabase**

Run from repo root:
```bash
supabase db push
```
Expected: migration applied with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260614120000_support_messages.sql
git commit -m "feat(db): add support_messages table with RLS and admin RPC"
```

---

### Task 2: Web support page

**Files:**
- Create: `apps/web/app/support/page.tsx`

- [ ] **Step 1: Create the support page**

```tsx
// apps/web/app/support/page.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

async function submitSupportMessage(formData: FormData) {
  'use server';
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const message = formData.get('message') as string;

  if (!name?.trim() || !email?.trim() || !message?.trim()) return;

  const supabase = await createClient();
  await supabase.from('support_messages').insert({ name, email, message });
  redirect('/support?sent=1');
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#f9fafb' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px 36px', width: '100%', maxWidth: '440px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#111827' }}>Need help?</h1>
        <p style={{ color: '#6b7280', marginBottom: '28px', fontSize: '15px' }}>We're here for you. Send us a message and we'll get back to you within 24 hours.</p>

        {sent ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px', color: '#15803d', textAlign: 'center' }}>
            Message sent! We'll be in touch soon.
          </div>
        ) : (
          <form action={submitSupportMessage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Your name</label>
              <input
                name="name"
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Email</label>
              <input
                name="email"
                type="email"
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Message</label>
              <textarea
                name="message"
                required
                rows={5}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              style={{ padding: '12px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
            >
              Send Message
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify it builds**

```bash
cd cost-share-app && yarn workspace @cost-share/web build 2>&1 | tail -20
```
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/support/page.tsx
git commit -m "feat(web): add /support contact form page"
```

---

### Task 3: Admin service — listSupportMessages

**Files:**
- Modify: `apps/mobile/services/admin.service.ts`

- [ ] **Step 1: Add the SupportMessage interface and listSupportMessages function**

Add at the end of `apps/mobile/services/admin.service.ts`:

```typescript
export interface SupportMessage {
    id: string;
    name: string;
    email: string;
    message: string;
    createdAt: Date;
}

type SupportMessageRow = {
    id: string;
    name: string;
    email: string;
    message: string;
    created_at: string;
};

export async function listSupportMessages(): Promise<SupportMessage[]> {
    const { data, error } = await supabase.rpc('admin_list_support_messages');
    if (error || !data) {
        if (error) console.warn('listSupportMessages: RPC failed', error);
        return [];
    }
    return (data as SupportMessageRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        message: r.message,
        createdAt: new Date(r.created_at),
    }));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/services/admin.service.ts
git commit -m "feat(mobile): add listSupportMessages admin service"
```

---

### Task 4: React Query hook for support messages

**Files:**
- Modify: `apps/mobile/hooks/queries/keys.ts`
- Create: `apps/mobile/hooks/queries/useAdminSupportMessagesQuery.ts`

- [ ] **Step 1: Add query key**

In `apps/mobile/hooks/queries/keys.ts`, add inside the `queryKeys` object alongside `adminPlatformMetrics`:

```typescript
adminSupportMessages: ['admin', 'support-messages'] as const,
```

- [ ] **Step 2: Create the query hook**

```typescript
// apps/mobile/hooks/queries/useAdminSupportMessagesQuery.ts
import { useQuery } from '@tanstack/react-query';
import { listSupportMessages } from '../../services/admin.service';
import { queryKeys } from './keys';

export function useAdminSupportMessagesQuery() {
    return useQuery({
        queryKey: queryKeys.adminSupportMessages,
        queryFn: listSupportMessages,
        staleTime: 30_000,
    });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/hooks/queries/keys.ts apps/mobile/hooks/queries/useAdminSupportMessagesQuery.ts
git commit -m "feat(mobile): add useAdminSupportMessagesQuery hook"
```

---

### Task 5: AdminSupportMessagesScreen

**Files:**
- Create: `apps/mobile/screens/admin/AdminSupportMessagesScreen.tsx`

- [ ] **Step 1: Create the screen**

```tsx
// apps/mobile/screens/admin/AdminSupportMessagesScreen.tsx
import React from 'react';
import { View, FlatList, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/AppText';
import { useAdminSupportMessagesQuery } from '../../hooks/queries/useAdminSupportMessagesQuery';
import { toDate } from '../../lib/dateUtils';

export function AdminSupportMessagesScreen() {
    const { t } = useTranslation();
    const query = useAdminSupportMessagesQuery();

    if (!query.isLoading && (query.data ?? []).length === 0) {
        return (
            <View className="flex-1 items-center justify-center bg-slate-50 px-8">
                <Text className="text-gray-500 text-center">{t('admin.supportMessages.empty')}</Text>
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <FlatList
                data={query.data ?? []}
                keyExtractor={(r) => r.id}
                refreshControl={
                    <RefreshControl
                        refreshing={query.isRefetching}
                        onRefresh={() => void query.refetch()}
                    />
                }
                contentContainerStyle={{ paddingVertical: 12 }}
                renderItem={({ item }) => (
                    <View className="bg-white px-4 py-3 mx-3 mb-2 rounded-xl">
                        <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
                            <Text className="text-xs text-gray-400">
                                {toDate(item.createdAt).toLocaleDateString()}
                            </Text>
                        </View>
                        <Text className="text-xs text-primary mb-2">{item.email}</Text>
                        <Text className="text-sm text-gray-700">{item.message}</Text>
                    </View>
                )}
            />
        </View>
    );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/screens/admin/AdminSupportMessagesScreen.tsx
git commit -m "feat(mobile): add AdminSupportMessagesScreen"
```

---

### Task 6: Wire up navigation and admin portal

**Files:**
- Modify: `apps/mobile/navigation/AppNavigator.tsx`
- Modify: `apps/mobile/screens/admin/AdminPortalScreen.tsx`

- [ ] **Step 1: Register screen in AppNavigator**

In `apps/mobile/navigation/AppNavigator.tsx`, add the import alongside the other admin imports:

```typescript
import { AdminSupportMessagesScreen } from '../screens/admin/AdminSupportMessagesScreen';
```

Then add the screen inside the Stack navigator alongside the other Admin screens:

```tsx
<Stack.Screen
    name="AdminSupportMessages"
    component={AdminSupportMessagesScreen}
    options={{ title: t('admin.supportMessages.title') }}
/>
```

- [ ] **Step 2: Add row in AdminPortalScreen**

In `apps/mobile/screens/admin/AdminPortalScreen.tsx`, add a new `SettingsRow` inside the existing `SettingsSection`, after the errors row:

```tsx
<SettingsRow
    iconName="chatbubble-ellipses-outline"
    label={t('admin.supportMessages.portalRow')}
    variant="chevron"
    onPress={() => navigation.navigate('AdminSupportMessages')}
    testID="admin-portal-support-messages"
/>
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit 2>&1 | head -20
```
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/navigation/AppNavigator.tsx apps/mobile/screens/admin/AdminPortalScreen.tsx
git commit -m "feat(mobile): wire AdminSupportMessages into nav and admin portal"
```

---

### Task 7: i18n strings

**Files:**
- Modify: `apps/mobile/i18n/locales/en.json`
- Modify: `apps/mobile/i18n/locales/he.json`

- [ ] **Step 1: Add English strings**

In `apps/mobile/i18n/locales/en.json`, inside the `"admin"` object, add:

```json
"supportMessages": {
    "title": "Support Messages",
    "portalRow": "Support messages",
    "empty": "No support messages yet"
}
```

- [ ] **Step 2: Add Hebrew strings**

In `apps/mobile/i18n/locales/he.json`, inside the `"admin"` object, add:

```json
"supportMessages": {
    "title": "הודעות תמיכה",
    "portalRow": "הודעות תמיכה",
    "empty": "אין הודעות תמיכה עדיין"
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/i18n/locales/en.json apps/mobile/i18n/locales/he.json
git commit -m "feat(mobile): add i18n strings for support messages"
```

---

## Done

After all tasks:
- Web: `https://kupapay.com/support` works as the Support URL in the App Store
- Mobile: Admin portal → "Support messages" shows all submitted messages, newest first
