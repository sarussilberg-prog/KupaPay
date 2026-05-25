# App-Wide Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make group metadata (name/image/description/type/default_currency/note), friend requests, friendships, and per-user archive state propagate live across all devices via a single app-level Supabase realtime channel.

**Architecture:** One channel per authenticated user (`app:user:<userId>`) with five `postgres_changes` listeners, mounted once at the app root via a new `useAppRealtime` hook. Per-group high-volume streams (expenses/settlements/messages) remain on the existing per-screen channels — unchanged.

**Tech Stack:** TypeScript + React Native (Expo 55) + Supabase JS realtime + Zustand store + React Query. SQL migration adds three tables to the `supabase_realtime` publication.

**Spec:** `docs/superpowers/specs/2026-05-25-app-wide-realtime-design.md`

---

## File Map

- **Create:** `cost-share-app/supabase/realtime-friends-archive.sql` — idempotent migration adding `friendships`, `friend_requests`, `group_user_archive` to the realtime publication.
- **Create:** `cost-share-app/apps/mobile/hooks/useAppRealtime.ts` — the new user-level realtime hook.
- **Modify:** `cost-share-app/apps/mobile/App.tsx` — mount `useAppRealtime` inside the authenticated branch.
- **Modify:** `cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx` — remove the now-redundant `useUserGroupMembershipsRealtime` call and its import.
- **Delete:** `cost-share-app/apps/mobile/hooks/useUserGroupMembershipsRealtime.ts` — logic absorbed into `useAppRealtime`.

## Conventions

- Branch is `dev` (already checked out). Database for dev is `drxfbicunusmipdgbgdk` (per `cost-share-app/apps/mobile/AGENTS.md`).
- Apply SQL migrations to the dev DB via the Supabase MCP tool `apply_migration` (this plan provides the SQL inline).
- Run TypeScript checks via `pnpm --filter mobile typecheck` (or `pnpm --filter @cost-share/mobile typecheck` — try both; project uses pnpm workspaces).
- No unit tests for realtime hooks — the existing pattern relies on manual two-device verification. Final validation is in Task 7.
- Commit after each task.

---

### Task 1: SQL migration — publish friends + archive tables

**Files:**
- Create: `cost-share-app/supabase/realtime-friends-archive.sql`

- [ ] **Step 1: Write the migration**

Create `cost-share-app/supabase/realtime-friends-archive.sql`:

```sql
-- Realtime: publish friendships, friend_requests, and group_user_archive so
-- the mobile client can subscribe to live INSERT/UPDATE/DELETE for the
-- current user's friend graph and per-device archive state.
--
-- RLS already restricts SELECT on all three tables to the owner(s) of the
-- row (auth.uid() matches a column on the row), so realtime delivery is
-- automatically scoped per user.
--
-- Idempotent: safe to re-run.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'friendships'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'friend_requests'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'group_user_archive'
    ) THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.group_user_archive';
    END IF;
END $$;
```

- [ ] **Step 2: Apply the migration to the dev database**

Use the Supabase MCP `apply_migration` tool with name `realtime_friends_archive` and the SQL above. (Migration goes to dev project `drxfbicunusmipdgbgdk`.)

- [ ] **Step 3: Verify the publication**

Use the Supabase MCP `execute_sql` tool with:

```sql
SELECT tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;
```

Expected output includes: `expenses`, `friend_requests`, `friendships`, `group_members`, `group_messages`, `group_user_archive`, `groups`, `settlements`.

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/supabase/realtime-friends-archive.sql
git commit -m "feat(supabase): publish friendships, friend_requests, group_user_archive on realtime"
```

---

### Task 2: Create `useAppRealtime` with `groups` listener + reconnect snapshot

**Files:**
- Create: `cost-share-app/apps/mobile/hooks/useAppRealtime.ts`

This task stands up the channel skeleton, the `groups` listener, and the snapshot-on-reconnect logic. Subsequent tasks bolt on additional listeners.

- [ ] **Step 1: Create the hook file**

Create `cost-share-app/apps/mobile/hooks/useAppRealtime.ts`:

```ts
/**
 * useAppRealtime — single app-level Supabase channel that keeps user-level
 * data (groups metadata, memberships, friends, friend requests, per-user
 * archive) live across all screens.
 *
 * Mounted once at the App root after authentication, identified by userId.
 * Per-group high-volume streams (expenses/settlements/messages) stay on
 * their own per-screen hooks.
 *
 * On (re)subscribe we run a one-shot snapshot refetch so any events missed
 * while disconnected are reconciled.
 */

import { useEffect } from 'react';
import { groupFromRow, type GroupWithMembers } from '@cost-share/shared';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store';
import { fetchGroups } from '../services/groups.service';
import { fetchBalanceSummary } from '../services/users.service';
import { queryClient } from '../lib/queryClient';
import { queryKeys } from './queries/keys';

type RealtimePayload = {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE';
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
};

function snapshotRefetch(): void {
    void fetchGroups();
    void fetchBalanceSummary();
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
    void queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsIncoming });
    void queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsOutgoing });
}

function handleGroupsEvent(payload: RealtimePayload): void {
    const store = useAppStore.getState();

    if (payload.eventType === 'DELETE' && payload.old) {
        const oldId = payload.old.id as string | undefined;
        if (oldId) store.removeGroup(oldId);
        return;
    }

    if (payload.eventType === 'UPDATE' && payload.new) {
        const id = payload.new.id as string | undefined;
        if (!id) return;

        const isActive = payload.new.is_active !== false;
        if (!isActive) {
            store.removeGroup(id);
            return;
        }

        const existing = store.groups.find(g => g.id === id);
        if (!existing) return; // membership listener will refetch the full row

        const base = groupFromRow(payload.new);
        const merged: GroupWithMembers = {
            ...base,
            members: existing.members,
            isArchivedByMe: existing.isArchivedByMe,
            isAutoArchived: existing.isAutoArchived,
        };
        store.updateGroup(merged);
    }
    // INSERT: ignore. New groups come in via the group_members listener,
    // which refetches the full groups list with members joined.
}

export function useAppRealtime(userId: string | undefined | null): void {
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`app:user:${userId}`)
            .on(
                'postgres_changes' as never,
                { event: '*', schema: 'public', table: 'groups' },
                (payload: RealtimePayload) => {
                    try {
                        handleGroupsEvent(payload);
                    } catch (err) {
                        console.error('app realtime: groups payload error:', err);
                    }
                },
            )
            .subscribe(status => {
                if (status === 'SUBSCRIBED') {
                    snapshotRefetch();
                }
            });

        return () => {
            void channel.unsubscribe();
            void supabase.removeChannel(channel);
        };
    }, [userId]);
}
```

- [ ] **Step 2: Verify the file typechecks**

Run from repo root:

```bash
pnpm --filter mobile typecheck
```

Expected: no errors related to `useAppRealtime.ts`. If `pnpm --filter mobile` fails, try `pnpm --filter @cost-share/mobile typecheck`. If neither works, fall back to:

```bash
cd cost-share-app/apps/mobile && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add cost-share-app/apps/mobile/hooks/useAppRealtime.ts
git commit -m "feat(mobile): add useAppRealtime with groups listener + reconnect snapshot"
```

---

### Task 3: Add `group_members` listener (port from old hook)

**Files:**
- Modify: `cost-share-app/apps/mobile/hooks/useAppRealtime.ts`

- [ ] **Step 1: Add the listener and handler**

In `useAppRealtime.ts`, add a new helper function above `useAppRealtime`:

```ts
function handleMembershipEvent(payload: RealtimePayload): void {
    const store = useAppStore.getState();
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });

    if (payload.eventType === 'DELETE' && payload.old) {
        const groupId = payload.old.group_id as string | undefined;
        if (groupId) store.removeGroup(groupId);
        return;
    }

    if (
        payload.eventType === 'UPDATE' &&
        payload.new &&
        payload.new.is_active === false
    ) {
        const groupId = payload.new.group_id as string | undefined;
        if (groupId) store.removeGroup(groupId);
        return;
    }

    if (
        payload.eventType === 'INSERT' ||
        (payload.eventType === 'UPDATE' && payload.new?.is_active === true)
    ) {
        void fetchGroups();
        void fetchBalanceSummary();
    }
}
```

Then, inside the channel builder in the `useAppRealtime` hook, chain another `.on(...)` call AFTER the existing groups listener and BEFORE `.subscribe(...)`:

```ts
            .on(
                'postgres_changes' as never,
                {
                    event: '*',
                    schema: 'public',
                    table: 'group_members',
                    filter: `user_id=eq.${userId}`,
                },
                (payload: RealtimePayload) => {
                    try {
                        handleMembershipEvent(payload);
                    } catch (err) {
                        console.error('app realtime: memberships payload error:', err);
                    }
                },
            )
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter mobile typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add cost-share-app/apps/mobile/hooks/useAppRealtime.ts
git commit -m "feat(mobile): port group_members realtime into useAppRealtime"
```

---

### Task 4: Add `friendships` + `friend_requests` listeners

**Files:**
- Modify: `cost-share-app/apps/mobile/hooks/useAppRealtime.ts`

- [ ] **Step 1: Add the handler helpers**

In `useAppRealtime.ts`, add two more helpers above `useAppRealtime`:

```ts
function handleFriendshipsEvent(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.friends });
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
}

function handleFriendRequestsEvent(): void {
    void queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsIncoming });
    void queryClient.invalidateQueries({ queryKey: queryKeys.friendRequestsOutgoing });
}
```

- [ ] **Step 2: Wire two more listeners into the channel**

Chain two more `.on(...)` calls inside `useAppRealtime`, after the `group_members` listener and before `.subscribe(...)`:

```ts
            .on(
                'postgres_changes' as never,
                { event: '*', schema: 'public', table: 'friendships' },
                () => {
                    try {
                        handleFriendshipsEvent();
                    } catch (err) {
                        console.error('app realtime: friendships payload error:', err);
                    }
                },
            )
            .on(
                'postgres_changes' as never,
                { event: '*', schema: 'public', table: 'friend_requests' },
                () => {
                    try {
                        handleFriendRequestsEvent();
                    } catch (err) {
                        console.error('app realtime: friend_requests payload error:', err);
                    }
                },
            )
```

(No filter — RLS already restricts both tables to the involved users.)

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter mobile typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/apps/mobile/hooks/useAppRealtime.ts
git commit -m "feat(mobile): add friendships + friend_requests realtime"
```

---

### Task 5: Add `group_user_archive` listener

**Files:**
- Modify: `cost-share-app/apps/mobile/hooks/useAppRealtime.ts`

- [ ] **Step 1: Add the archive handler**

In `useAppRealtime.ts`, add another helper above `useAppRealtime`:

```ts
function handleArchiveEvent(payload: RealtimePayload): void {
    const store = useAppStore.getState();

    if (payload.eventType === 'INSERT' && payload.new) {
        const groupId = payload.new.group_id as string | undefined;
        if (!groupId) return;
        const existing = store.groups.find(g => g.id === groupId);
        if (!existing) return;
        store.updateGroup({ ...existing, isArchivedByMe: true });
        return;
    }

    if (payload.eventType === 'DELETE' && payload.old) {
        const groupId = payload.old.group_id as string | undefined;
        if (!groupId) return;
        const existing = store.groups.find(g => g.id === groupId);
        if (!existing) return;
        store.updateGroup({ ...existing, isArchivedByMe: false });
        return;
    }
    // UPDATE: not expected (rows are existence-based); ignore.
}
```

- [ ] **Step 2: Wire the listener**

Chain one more `.on(...)` inside `useAppRealtime`, after the `friend_requests` listener and before `.subscribe(...)`:

```ts
            .on(
                'postgres_changes' as never,
                {
                    event: '*',
                    schema: 'public',
                    table: 'group_user_archive',
                    filter: `user_id=eq.${userId}`,
                },
                (payload: RealtimePayload) => {
                    try {
                        handleArchiveEvent(payload);
                    } catch (err) {
                        console.error('app realtime: archive payload error:', err);
                    }
                },
            )
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter mobile typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add cost-share-app/apps/mobile/hooks/useAppRealtime.ts
git commit -m "feat(mobile): add group_user_archive realtime listener"
```

---

### Task 6: Mount `useAppRealtime` in App.tsx and remove the old hook

**Files:**
- Modify: `cost-share-app/apps/mobile/App.tsx`
- Modify: `cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx`
- Delete: `cost-share-app/apps/mobile/hooks/useUserGroupMembershipsRealtime.ts`

- [ ] **Step 1: Add the import to App.tsx**

In `cost-share-app/apps/mobile/App.tsx`, just below the existing import line:

```ts
import { useAppStore } from './store';
```

add:

```ts
import { useAppRealtime } from './hooks/useAppRealtime';
```

- [ ] **Step 2: Mount the hook inside the App component**

In `App.tsx`, find the line `const { session, setSession } = useAppStore();` (currently around line 56). Right below it, add:

```ts
  const currentUserId = useAppStore((s) => s.currentUser?.id ?? null);
  useAppRealtime(currentUserId);
```

Rationale: `currentUser` is hydrated by `hydrateCurrentUserProfile` during the auth flow and cleared on sign-out, so the hook activates and tears down on every sign-in / sign-out cycle without needing extra wiring.

- [ ] **Step 3: Remove the old hook call and import from GroupsListScreen**

In `cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx`:

Delete the import line:

```ts
import { useUserGroupMembershipsRealtime } from '../../hooks/useUserGroupMembershipsRealtime';
```

Delete the call inside the component (currently around line 70):

```ts
    useUserGroupMembershipsRealtime(currentUserId);
```

- [ ] **Step 4: Delete the old hook file**

```bash
git rm cost-share-app/apps/mobile/hooks/useUserGroupMembershipsRealtime.ts
```

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter mobile typecheck
```

Expected: no errors. If the typechecker flags any other file that imported `useUserGroupMembershipsRealtime`, grep for remaining references and clean them up:

```bash
rg "useUserGroupMembershipsRealtime" cost-share-app/apps/mobile
```

Expected output: no matches.

- [ ] **Step 6: Commit**

```bash
git add cost-share-app/apps/mobile/App.tsx cost-share-app/apps/mobile/screens/groups/GroupsListScreen.tsx
git commit -m "feat(mobile): mount useAppRealtime at root, retire useUserGroupMembershipsRealtime"
```

---

### Task 7: Manual two-device verification

**Files:** none (validation only)

This is the gate that proves the feature works. The codebase has no unit-test pattern for realtime hooks (mocking Supabase channels would not catch the RLS / publication / network issues that matter), so we verify end-to-end with two devices.

Setup: install the current build on two devices (or one device + Expo Go on another), sign in to the **same Supabase project (dev)** with **two different test accounts** that are members of at least one shared group.

- [ ] **Step 1: Group rename test**

On Device A: open the shared group, edit the group name to a new value, save.
On Device B: without touching the screen, observe.

Expected on Device B within ~1s:
- Groups List shows the new name.
- If Group Detail is open for that group, the title in the cover updates.

- [ ] **Step 2: Group image / metadata test**

On Device A: change the group image, then the description, then the default currency.
Expected on Device B within ~1s for each: the corresponding field updates without a manual pull-to-refresh.

- [ ] **Step 3: Friend request test**

Sign in a third test account on Device C (or sign out / in to a different account on Device B). Send a friend request from Device A to that account.

Expected on the receiving device within ~1s: the request appears in the incoming requests list (Friends screen) without reload.

Accept the request on the receiving device.

Expected on Device A within ~1s: the new friend appears in the friends list.

- [ ] **Step 4: Multi-device archive test**

Sign in to the **same user account** on Devices A and B. On Device A, archive a group from the Groups List.

Expected on Device B within ~1s: the same group moves to the archived state (no longer in the default list, visible under "archived" filter).

- [ ] **Step 5: Reconnect / snapshot test**

On Device B: enable airplane mode.
On Device A: edit the shared group name.
On Device B: disable airplane mode.

Expected on Device B within ~2s of reconnect: the group name updates (via the snapshot-on-reconnect refetch even though the realtime event was missed during the offline window).

- [ ] **Step 6: No-regression test**

On the shared group on Device A, add a new expense, send a chat message, and record a settlement.
Expected on Device B (Group Detail open): all three appear live as they did before (no regression in the existing per-screen channels).

- [ ] **Step 7: Channel inventory check (optional but recommended)**

In the Supabase dashboard for the dev project → Realtime inspector, while a single user is signed in: confirm there is exactly **one** `app:user:<uuid>` channel for that user (plus per-group channels only while a Group Detail screen is open).

- [ ] **Step 8: Final commit (if any fixups were needed)**

If any of the above tests failed and required code adjustments, commit them now:

```bash
git status
# review changes, then:
git add <files>
git commit -m "fix(mobile): <specific issue found during two-device verification>"
```

If everything passed on the first run, this step is a no-op.
