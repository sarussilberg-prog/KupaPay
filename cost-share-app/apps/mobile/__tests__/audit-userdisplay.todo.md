# UserDisplay migration audit

Generated for Phase E of the account-deletion-v2 plan.

## Services — profile selects missing `is_active`

- [ ] `services/users.service.ts:24` — current select: `.select('*')` in `fetchUsers()` → add `is_active` explicitly
- [ ] `services/users.service.ts:50` — current select: `.select('*')` in `fetchGroupUsers()` → add `is_active` explicitly
- [ ] `services/users.service.ts:63` — current select: `.select('*')` in `getUserById()` → add `is_active` explicitly
- [ ] `services/users.service.ts:101-104` — current select: `.select()` in `updateUser()` → add `is_active` to returned fields
- [ ] `services/friends.service.ts:67` — current select: `.select('*')` in `fetchFriends()` → add `is_active` explicitly
- [ ] `services/friends.service.ts:78` — current select: `.select('*')` in `fetchProfilesByIds()` → add `is_active` explicitly
- [ ] `services/groups.service.ts:343` — current select: `.select('id, name, avatar_url')` in `fetchProfilesByUserIds()` → add `is_active`
- [ ] `services/groups.service.ts:453` — current select: `.select('id, name')` in `getGroupSimplifiedDebtsByCurrency()` → add `is_active`
- [ ] `services/activity.service.ts:92` — current select: `.select('id, name, avatar_url')` in `fetchProfiles()` → add `is_active`
- [ ] `services/groups.service.ts:112` — nested select in `fetchGroups()`: `profiles(id, name, avatar_url)` → add `is_active` to nested profiles select

**Note:** Selects using wildcard `'*'` implicitly include all columns (including `is_active`), but explicit inclusion is recommended for clarity and future-proofing. Targeted selects (like `id, name, avatar_url`) must be updated to include `is_active`.

## Components / screens — `.name` usages to migrate

- [ ] `components/UnequalSplitPanel.tsx:73` — `member.name` → `getDisplayName(member, t)`
- [ ] `components/PayerPicker.tsx:52` — `member.name` → `getDisplayName(member, t)`
- [ ] `components/AddMembersSheet.tsx:71` — `u.name?.toLowerCase()` → use `getDisplayName()` then lowercase
- [ ] `components/MemberSelector.tsx:70` — `member.name` → `getDisplayName(member, t)`
- [ ] `components/MemberSelector.tsx:100` — `item.name` → `getDisplayName(item, t)`
- [ ] `components/GroupCard.tsx:67` — `group.name` (group, not user—skip)
- [ ] `components/GroupHero.tsx:122` — `group.name` (group, not user—skip)
- [ ] `components/dashboard/FriendBalanceRow.tsx:56` — `friend.name` → `getDisplayName(friend, t)`
- [ ] `components/dashboard/FriendGroupBalancesSheet.tsx:146` — `friend?.name ?? ''` → `getDisplayName(friend, t)`
- [ ] `screens/activity/ActivityFeedScreen.tsx:98` — `g.name` (group, not user—skip)
- [ ] `screens/groups/CreateGroupScreen.tsx:331` — `m.name` → `getDisplayName(m, t)`
- [ ] `screens/groups/GroupsListScreen.tsx:145` — `g.name.toLowerCase()` (group, not user—skip)
- [ ] `screens/expenses/ExpenseDetailScreen.tsx:62` — `allUsers.find(...)?. name` → wrap in `getDisplayName()`
- [ ] `screens/groups/GroupDetailScreen.tsx:142` — `u.name ?? u.id.slice(0, 8)` → `getDisplayName(u, t)`
- [ ] `screens/profile/EditProfileScreen.tsx:29` — `currentUser?.name` → `getDisplayName(currentUser, t)`
- [ ] `screens/profile/EditProfileScreen.tsx:99` — `name.trim() || currentUser?.name` → use `getDisplayName()`
- [ ] `screens/profile/FindFriendsScreen.tsx:231` — `r.user.name || '—'` → `getDisplayName(r.user, t)`
- [ ] `screens/groups/GroupMembersScreen.tsx:67` — `user.name` → `getDisplayName(user, t)`
- [ ] `screens/profile/ProfileScreen.tsx:96` — `currentUser?.name || t('common.unknown')` → `getDisplayName(currentUser, t)`
- [ ] `screens/balances/SettlementHistoryScreen.tsx:53` — `allUsers.find(...)?. name` → wrap in `getDisplayName()`
- [ ] `screens/balances/SettleUpListScreen.tsx:63` — `g.id === groupId)?.name` (group, not user—skip)
- [ ] `screens/balances/SettleUpListScreen.tsx:77` — `m.name` → `getDisplayName(m, t)`
- [ ] `screens/profile/FriendsScreen.tsx:164` — `req.profile?.name ?? '?'` → `getDisplayName(req.profile, t)`
- [ ] `screens/profile/FriendsScreen.tsx:229` — `f.name` → `getDisplayName(f, t)`
- [ ] `screens/balances/BalancesScreen.tsx:59` — `g.id === groupId)?.name` (group, not user—skip)
- [ ] `screens/balances/BalancesScreen.tsx:93` — `u.name` → `getDisplayName(u, t)`

**Total user `.name` references requiring migration: ~18–22** (excluding group.name references)

## Components / screens — `.avatar_url` or `avatarUrl` usages to migrate

- [ ] `components/FeedItemRow.tsx:42` — `actor?.avatarUrl` → `getAvatarUrl(actor)`
- [ ] `components/FeedItemRow.tsx:64` — `actor?.avatarUrl` → `getAvatarUrl(actor)`
- [ ] `components/FeedItemRow.tsx:77` — `sender?.avatarUrl` → `getAvatarUrl(sender)`
- [ ] `components/SettleUpSheet.tsx:174` — `fromMember?.avatarUrl` → `getAvatarUrl(fromMember)`
- [ ] `components/SettleUpSheet.tsx:198` — `toMember?.avatarUrl` → `getAvatarUrl(toMember)`
- [ ] `components/SettlementRow.tsx:46` — `actorAvatarUrl` → verify it comes from `getAvatarUrl()`
- [ ] `components/BalanceCard.tsx:50` — `avatarUrl` prop → ensure source passed through `getAvatarUrl()`
- [ ] `components/ActivityItem.tsx:39` — `activity.userAvatarUrl` → verify source uses `getAvatarUrl()`
- [ ] `components/UnequalSplitPanel.tsx:71` — `member.avatarUrl` → `getAvatarUrl(member)`
- [ ] `components/MemberAvatar.tsx:49` — receives `avatarUrl` prop; no inline filtering needed (already checked by caller)
- [ ] `components/ExpenseRow.tsx:71` — `actorAvatarUrl` → verify source uses `getAvatarUrl()`
- [ ] `components/PayerPicker.tsx:44` — `member.avatarUrl` → `getAvatarUrl(member)`
- [ ] `components/ProfileImagePicker.tsx:29` — `localUri ?? avatarUrl` → ensure avatarUrl from `getAvatarUrl()`
- [ ] `components/MemberSelector.tsx:62` — `member.avatarUrl` → `getAvatarUrl(member)`
- [ ] `components/MemberSelector.tsx:97` — `item.avatarUrl` → `getAvatarUrl(item)`
- [ ] `components/dashboard/ProfileHeaderRow.tsx:26` — `avatarUrl` prop → ensure source uses `getAvatarUrl()`
- [ ] `components/dashboard/FriendBalanceRow.tsx:46` — `friend.avatarUrl` → `getAvatarUrl(friend)`
- [ ] `components/balances/DebtRow.tsx:53` — `fromAvatar` — verify source uses `getAvatarUrl()`
- [ ] `components/balances/DebtRow.tsx:57` — `toAvatar` — verify source uses `getAvatarUrl()`
- [ ] `components/dashboard/FriendGroupBalancesSheet.tsx:140` — `friend.avatarUrl` → `getAvatarUrl(friend)`
- [ ] `components/MessageRow.tsx:84` — `senderAvatarUrl` → verify source uses `getAvatarUrl()`
- [ ] `components/balances/MemberContributionRow.tsx:52` — `avatarUrl` prop → ensure source uses `getAvatarUrl()`
- [ ] `screens/groups/GroupDetailScreen.tsx:143` — `u.avatarUrl` → `getAvatarUrl(u)`
- [ ] `screens/profile/EditProfileScreen.tsx:55` — `currentUser.avatarUrl` → `getAvatarUrl(currentUser)`
- [ ] `screens/profile/EditProfileScreen.tsx:100` — `currentUser?.avatarUrl` → `getAvatarUrl(currentUser)`
- [ ] `components/balances/MemberContributionBreakdown.tsx:87` — `member.avatarUrl` → `getAvatarUrl(member)`
- [ ] `components/balances/MemberContributionBreakdown.tsx:137` — `other.avatarUrl` → `getAvatarUrl(other)`
- [ ] `screens/groups/CreateGroupScreen.tsx:312` — `m.avatarUrl` → `getAvatarUrl(m)`
- [ ] `screens/groups/GroupMembersScreen.tsx:64` — `user.avatarUrl` → `getAvatarUrl(user)`
- [ ] `screens/profile/FriendsScreen.tsx:160` — `req.profile?.avatarUrl` → `getAvatarUrl(req.profile)`
- [ ] `screens/profile/FriendsScreen.tsx:226` — `f.avatarUrl` → `getAvatarUrl(f)`
- [ ] `screens/profile/ProfileScreen.tsx:97` — `currentUser?.avatarUrl` → `getAvatarUrl(currentUser)`
- [ ] `screens/balances/SettleUpListScreen.tsx:78` — `m.avatarUrl` → `getAvatarUrl(m)`
- [ ] `screens/balances/SettleUpListScreen.tsx:236` — `memberLites.find(...)?. avatarUrl` → `getAvatarUrl()`
- [ ] `screens/balances/SettleUpListScreen.tsx:239` — `memberLites.find(...)?. avatarUrl` → `getAvatarUrl()`
- [ ] `screens/balances/SettleUpListScreen.tsx:279` — nested `?.avatarUrl` → `getAvatarUrl()`
- [ ] `screens/balances/SettleUpListScreen.tsx:283` — nested `?.avatarUrl` → `getAvatarUrl()`
- [ ] `screens/balances/SettleUpListScreen.tsx:408` — `fromAvatar` (from computed map) → verify source
- [ ] `screens/balances/SettleUpListScreen.tsx:412` — `toAvatar` (from computed map) → verify source
- [ ] `screens/profile/FindFriendsScreen.tsx:226` — `r.user.avatarUrl` → `getAvatarUrl(r.user)`
- [ ] `screens/balances/BalancesScreen.tsx:94` — `u.avatarUrl` → `getAvatarUrl(u)`
- [ ] `screens/balances/BalancesScreen.tsx:101` — `m.avatarUrl` in map → `getAvatarUrl(m)`
- [ ] `screens/balances/BalancesScreen.tsx:234` — `member.avatarUrl` → `getAvatarUrl(member)`

**Total avatar reference call sites: ~45** (some pass through intermediate computed values; trace data flow)

## Avatar primitive

- [x] **State:** `MemberAvatar.tsx` exists at `components/MemberAvatar.tsx` and already renders a fallback (initials on slate-100 bg) when `avatarUrl` is null/undefined. No changes needed to the component itself; it already handles the null case gracefully.

## Push notifications

- [x] **State:** No push notification infrastructure exists. No `expo-notifications`, `expo-push`, `push_token`, `sendPush`, or `sendNotification` found in the codebase. Phase E5 (push-notification dispatch filtering) is not applicable.

## Summary

- **Total profile selects to fix:** 10 (4 using wildcard; 6 using targeted fields)
  - Wildcard selects are implicitly safe but should be reviewed for clarity
  - Targeted selects (missing `is_active`): 6 (activity.service, groups.service×2, friends.service×2)
  
- **Total `.name` consumer call sites:** ~18–22 (excluding group.name)
  
- **Total `.avatar_url` / `avatarUrl` consumer call sites:** ~45 (including indirect references through computed maps)
  
- **Avatar primitive:** YES, `components/MemberAvatar.tsx` — already handles null/undefined avatarUrl gracefully with initials fallback. **No E4 changes needed.**
  
- **Push dispatch:** NO — not implemented yet. Phase E5 (push filtering) is deferred or out of scope.

## Migration phases

### Phase E2: Update all profile `.select()` calls
- Services: `activity.service.ts`, `friends.service.ts`, `groups.service.ts`, `users.service.ts`
- Add `is_active` to all targeted selects; clarify wildcard `'*'` selects

### Phase E3: Update all direct `.name` access
- ~18–22 component/screen call sites
- Replace with `getDisplayName(user, t)` calls
- Ensure `t` (i18n) is passed via useTranslation()

### Phase E4: Update all direct `.avatar_url` / `avatarUrl` access
- ~45 component/screen call sites
- Replace with `getAvatarUrl(user)` calls
- Trace computed maps and indirect references to ensure source data is routed through helpers

### Phase E5: Push notifications (deferred)
- No dispatch currently exists; filter will be added when notifications are implemented
