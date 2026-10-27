/**
 * App Navigator
 * Root Stack wraps the bottom Tab navigator. Screens that should not show
 * the tab bar (Settings + admin sub-screens, Create/Edit group, Add/Edit
 * expense) live on the Root Stack so they push above the tab navigator and
 * cover the tab bar naturally — no `tabBarStyle: 'none'` toggling, no
 * transition flash.
 */

import React, { useEffect } from 'react';
import { TouchableOpacity, View, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
    createNativeStackNavigator,
    type NativeStackNavigationOptions,
} from '@react-navigation/native-stack';
import { createTabPopToTopListener } from './tabNavigation';
import { useTranslation } from 'react-i18next';
import { useRtlLayout } from '../hooks/useRtlLayout';
import { AppIcon, AppIconName } from '../components/AppIcon';
import { UnreadBadge } from '../components/UnreadBadge';
import { CustomTabBar } from '../components/navigation/CustomTabBar';
import { colors } from '../theme';
import { useInviteRedemption } from '../hooks/useInviteRedemption';
import { usePendingNavigationFlush } from '../hooks/usePendingNavigationFlush';
import { usePushNotificationListeners } from '../hooks/usePushNotificationListeners';
import { useWebInAppPushFallback } from '../hooks/useWebInAppPushFallback';
import { useAuthUserId } from '../hooks/useAuthUserId';
import { prefetchGroupsList } from '../hooks/queries/prefetchGroupsList';
import { prefetchProfileWarmup } from '../hooks/queries/prefetchProfileWarmup';
import { prefetchAddExpensePrerequisitesForAllGroups } from '../hooks/queries/prefetchAddExpenseForAllGroups';
import { useActivityUnreadCount } from '../hooks/queries/useActivityUnreadCount';

function HeaderBackButton({ onPress }: { onPress: () => void }) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    return (
        <TouchableOpacity
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ paddingHorizontal: 4, paddingVertical: 4 }}
        >
            <AppIcon
                name={isRtl ? 'chevron-forward' : 'chevron-back'}
                size={26}
                color={colors.primary}
            />
        </TouchableOpacity>
    );
}

function tabBarIcon(
    focusedName: AppIconName,
    outlineName: AppIconName
): (props: { color: string; size: number; focused: boolean }) => React.ReactElement {
    return ({ color, size, focused }) => (
        <AppIcon name={focused ? focusedName : outlineName} size={size} color={color} />
    );
}
import { GroupsListScreen } from '../screens/groups/GroupsListScreen';
import { GroupDetailScreen } from '../screens/groups/GroupDetailScreen';
import { FavoriteGroupScreen } from '../screens/favoriteGroup/FavoriteGroupScreen';
import { CreateGroupScreen } from '../screens/groups/CreateGroupScreen';
import { GroupPostCreateInviteScreen } from '../screens/groups/GroupPostCreateInviteScreen';
import { GroupMembersScreen } from '../screens/groups/GroupMembersScreen';
import { GroupNoteScreen } from '../screens/groups/GroupNoteScreen';
import { ExpenseListScreen } from '../screens/expenses/ExpenseListScreen';
import { AddExpenseScreen } from '../screens/expenses/AddExpenseScreen';
import { ExpenseDetailScreen } from '../screens/expenses/ExpenseDetailScreen';
import { BalancesScreen } from '../screens/balances/BalancesScreen';
import { SettleUpListScreen } from '../screens/balances/SettleUpListScreen';
import { SettlementHistoryScreen } from '../screens/balances/SettlementHistoryScreen';
import { ActivityFeedScreen } from '../screens/activity/ActivityFeedScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { SettingsScreen } from '../screens/profile/SettingsScreen';
import { ContactUsScreen } from '../screens/profile/ContactUsScreen';
import { FriendsScreen } from '../screens/profile/FriendsScreen';
import { FindFriendsScreen } from '../screens/profile/FindFriendsScreen';
import { ReferralProgramScreen } from '../screens/profile/ReferralProgramScreen';
import { MySubscriptionScreen } from '../screens/profile/MySubscriptionScreen';
import { NotificationSettingsScreen } from '../screens/profile/NotificationSettingsScreen';
import { AdminPortalScreen } from '../screens/admin/AdminPortalScreen';
import { AdminOnboardingPreviewScreen } from '../screens/admin/AdminOnboardingPreviewScreen';
import { AdminDeletedUsersScreen } from '../screens/admin/AdminDeletedUsersScreen';
import { AdminErrorsScreen } from '../screens/admin/AdminErrorsScreen';
import { AdminErrorDetailScreen } from '../screens/admin/AdminErrorDetailScreen';
import { AdminErrorEventScreen } from '../screens/admin/AdminErrorEventScreen';
import { AdminSupportMessagesScreen } from '../screens/admin/AdminSupportMessagesScreen';
import { AdminMonetizationScreen } from '../screens/admin/AdminMonetizationScreen';
import { PaywallScreen } from '../screens/pro/PaywallScreen';
import { boundScreen } from './boundScreen';

/** One error boundary per route (#427). Reuse the same bound component across stacks. */
const Screen = {
    GroupsList: boundScreen(GroupsListScreen, 'GroupsList'),
    GroupDetail: boundScreen(GroupDetailScreen, 'GroupDetail'),
    FavoriteGroupHome: boundScreen(FavoriteGroupScreen, 'FavoriteGroupHome'),
    GroupMembers: boundScreen(GroupMembersScreen, 'GroupMembers'),
    GroupNote: boundScreen(GroupNoteScreen, 'GroupNote'),
    ExpenseList: boundScreen(ExpenseListScreen, 'ExpenseList'),
    ExpenseDetail: boundScreen(ExpenseDetailScreen, 'ExpenseDetail'),
    Balances: boundScreen(BalancesScreen, 'Balances'),
    SettleUpList: boundScreen(SettleUpListScreen, 'SettleUpList'),
    SettlementHistory: boundScreen(SettlementHistoryScreen, 'SettlementHistory'),
    ActivityFeed: boundScreen(ActivityFeedScreen, 'ActivityFeed'),
    ProfileMain: boundScreen(ProfileScreen, 'ProfileMain'),
    EditProfile: boundScreen(EditProfileScreen, 'EditProfile'),
    Friends: boundScreen(FriendsScreen, 'Friends'),
    FindFriends: boundScreen(FindFriendsScreen, 'FindFriends'),
    Settings: boundScreen(SettingsScreen, 'Settings'),
    Paywall: boundScreen(PaywallScreen, 'Paywall'),
    NotificationSettings: boundScreen(NotificationSettingsScreen, 'NotificationSettings'),
    ReferralProgram: boundScreen(ReferralProgramScreen, 'ReferralProgram'),
    MySubscription: boundScreen(MySubscriptionScreen, 'MySubscription'),
    ContactUs: boundScreen(ContactUsScreen, 'ContactUs'),
    AdminPortal: boundScreen(AdminPortalScreen, 'AdminPortal'),
    AdminDeletedUsers: boundScreen(AdminDeletedUsersScreen, 'AdminDeletedUsers'),
    AdminOnboardingPreview: boundScreen(AdminOnboardingPreviewScreen, 'AdminOnboardingPreview'),
    AdminErrors: boundScreen(AdminErrorsScreen, 'AdminErrors'),
    AdminErrorDetail: boundScreen(AdminErrorDetailScreen, 'AdminErrorDetail'),
    AdminErrorEvent: boundScreen(AdminErrorEventScreen, 'AdminErrorEvent'),
    AdminSupportMessages: boundScreen(AdminSupportMessagesScreen, 'AdminSupportMessages'),
    AdminMonetization: boundScreen(AdminMonetizationScreen, 'AdminMonetization'),
    CreateGroup: boundScreen(CreateGroupScreen, 'CreateGroup'),
    GroupPostCreateInvite: boundScreen(GroupPostCreateInviteScreen, 'GroupPostCreateInvite'),
    EditGroup: boundScreen(CreateGroupScreen, 'EditGroup'),
    AddExpense: boundScreen(AddExpenseScreen, 'AddExpense'),
    EditExpense: boundScreen(AddExpenseScreen, 'EditExpense'),
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function stackScreenOptions(isRtl: boolean): NativeStackNavigationOptions {
    // iOS: the native horizontal push isn't duration-tunable, so use simple_push,
    // which honors animationDuration (→150ms). Android: animationDuration is
    // iOS-only; ios_from_* runs at a fixed XML duration overridden to 150ms by the
    // withFastStackTransitions config plugin. RTL direction is explicit on Android;
    // iOS simple_push follows the native layout direction.
    const animation: NativeStackNavigationOptions['animation'] =
        Platform.OS === 'android' ? (isRtl ? 'ios_from_left' : 'ios_from_right') : 'simple_push';
    return {
        animation,
        animationDuration: 150,
        headerTintColor: colors.primary,
        headerBackTitle: '',
    };
}

function buildStackScreenOptions(isRtl: boolean) {
    const base = stackScreenOptions(isRtl);
    return ({ navigation }: { navigation: { canGoBack: () => boolean; goBack: () => void } }) => ({
        ...base,
        headerLeft: navigation.canGoBack()
            ? () => <HeaderBackButton onPress={() => navigation.goBack()} />
            : undefined,
    });
}

function GroupsStack() {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <Stack.Navigator screenOptions={buildStackScreenOptions(isRtl)}>
            <Stack.Screen
                name="GroupsList"
                component={Screen.GroupsList}
                options={{ title: t('tabs.groups'), headerShown: false }}
            />
            <Stack.Screen
                name="GroupDetail"
                component={Screen.GroupDetail}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="GroupMembers"
                component={Screen.GroupMembers}
                options={{ title: t('groups.members.title') }}
            />
            <Stack.Screen
                name="GroupNote"
                component={Screen.GroupNote}
                options={{ title: t('groups.note.title') }}
            />
            <Stack.Screen
                name="ExpenseList"
                component={Screen.ExpenseList}
                options={{ title: t('expenses.title') }}
            />
            <Stack.Screen
                name="ExpenseDetail"
                component={Screen.ExpenseDetail}
                options={{ title: t('expenses.expenseDetail') }}
            />
            <Stack.Screen
                name="Balances"
                component={Screen.Balances}
                options={{ title: t('balances.title') }}
            />
            <Stack.Screen
                name="SettleUpList"
                component={Screen.SettleUpList}
                options={{ title: t('settleUp.title') }}
            />
            <Stack.Screen
                name="SettlementHistory"
                component={Screen.SettlementHistory}
                options={{ title: t('balances.settlementHistory') }}
            />
        </Stack.Navigator>
    );
}

function FavoriteGroupStack() {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <Stack.Navigator screenOptions={buildStackScreenOptions(isRtl)}>
            <Stack.Screen
                name="FavoriteGroupHome"
                component={Screen.FavoriteGroupHome}
                // Seed params so GroupDetailScreen's `route.params.groupId`
                // destructure (which reads `route.params` directly) can't hit
                // `undefined` on the first frame before FavoriteGroupScreen's
                // useLayoutEffect sets the real id.
                initialParams={{ groupId: undefined }}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="GroupMembers"
                component={Screen.GroupMembers}
                options={{ title: t('groups.members.title') }}
            />
            <Stack.Screen
                name="GroupNote"
                component={Screen.GroupNote}
                options={{ title: t('groups.note.title') }}
            />
            <Stack.Screen
                name="ExpenseList"
                component={Screen.ExpenseList}
                options={{ title: t('expenses.title') }}
            />
            <Stack.Screen
                name="ExpenseDetail"
                component={Screen.ExpenseDetail}
                options={{ title: t('expenses.expenseDetail') }}
            />
            <Stack.Screen
                name="Balances"
                component={Screen.Balances}
                options={{ title: t('balances.title') }}
            />
            <Stack.Screen
                name="SettleUpList"
                component={Screen.SettleUpList}
                options={{ title: t('settleUp.title') }}
            />
            <Stack.Screen
                name="SettlementHistory"
                component={Screen.SettlementHistory}
                options={{ title: t('balances.settlementHistory') }}
            />
        </Stack.Navigator>
    );
}

function ActivityStack() {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <Stack.Navigator screenOptions={buildStackScreenOptions(isRtl)}>
            <Stack.Screen
                name="ActivityFeed"
                component={Screen.ActivityFeed}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="ExpenseDetail"
                component={Screen.ExpenseDetail}
                options={{ title: t('expenses.expenseDetail') }}
            />
        </Stack.Navigator>
    );
}

function ProfileStack() {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();

    return (
        <Stack.Navigator screenOptions={buildStackScreenOptions(isRtl)}>
            <Stack.Screen
                name="ProfileMain"
                component={Screen.ProfileMain}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="EditProfile"
                component={Screen.EditProfile}
                options={{ title: t('profile.editProfile') }}
            />
            <Stack.Screen
                name="Friends"
                component={Screen.Friends}
                options={{ title: t('friends.title') }}
            />
            <Stack.Screen
                name="FindFriends"
                component={Screen.FindFriends}
                options={{ title: t('friends.find.title') }}
            />
        </Stack.Navigator>
    );
}

function MainTabs() {
    const { t } = useTranslation();
    const { data: unreadCount = 0 } = useActivityUnreadCount();

    return (
        <Tab.Navigator
            initialRouteName="Groups"
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.gray400,
                headerShown: false,
            }}
        >
            <Tab.Screen
                name="Profile"
                component={ProfileStack}
                listeners={createTabPopToTopListener('ProfileMain')}
                options={{
                    tabBarLabel: t('tabs.profile'),
                    tabBarIcon: tabBarIcon('person', 'person-outline'),
                }}
            />
            <Tab.Screen
                name="Activity"
                component={ActivityStack}
                listeners={createTabPopToTopListener('ActivityFeed')}
                options={{
                    tabBarLabel: t('tabs.activity'),
                    tabBarIcon: ({ color, size, focused }) => (
                        <View>
                            <AppIcon
                                name={focused ? 'time' : 'time-outline'}
                                size={size}
                                color={color}
                            />
                            <UnreadBadge
                                count={unreadCount}
                                style={{ position: 'absolute', top: -6, right: -10 }}
                            />
                        </View>
                    ),
                }}
            />
            <Tab.Screen
                name="FavoriteGroup"
                component={FavoriteGroupStack}
                listeners={createTabPopToTopListener('FavoriteGroupHome')}
                options={{
                    tabBarLabel: t('tabs.favoriteGroup'),
                    tabBarIcon: tabBarIcon('star', 'star-outline'),
                }}
            />
            <Tab.Screen
                name="Groups"
                component={GroupsStack}
                listeners={createTabPopToTopListener('GroupsList')}
                options={{
                    tabBarLabel: t('tabs.groups'),
                    tabBarIcon: tabBarIcon('people', 'people-outline'),
                }}
            />
        </Tab.Navigator>
    );
}

const BoundMainTabs = boundScreen(MainTabs, 'MainTabs');

export function AppNavigator() {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    useInviteRedemption();
    usePendingNavigationFlush();
    usePushNotificationListeners();
    const userId = useAuthUserId();
    useWebInAppPushFallback(userId);

    useEffect(() => {
        prefetchGroupsList();
        prefetchProfileWarmup();
        // Fire-and-forget warm-up: any group that's already in the cache
        // gets its members + profiles fetched so AddExpense works offline
        // without ever opening the screen online first. prefetchGroupsList
        // populates the groups cache asynchronously, so we also retry after
        // a short delay to catch the post-fetch state.
        prefetchAddExpensePrerequisitesForAllGroups();
        const retry = setTimeout(
            () => prefetchAddExpensePrerequisitesForAllGroups(),
            1000,
        );
        return () => clearTimeout(retry);
    }, []);

    return (
        <RootStack.Navigator screenOptions={buildStackScreenOptions(isRtl)}>
            <RootStack.Screen
                name="Main"
                component={BoundMainTabs}
                options={{ headerShown: false }}
            />

            <RootStack.Screen
                name="Settings"
                component={Screen.Settings}
                options={{ title: t('settings.title') }}
            />
            <RootStack.Screen
                name="Paywall"
                component={Screen.Paywall}
                options={{ title: t('pro.paywall.title'), presentation: 'modal' }}
            />
            <RootStack.Screen
                name="NotificationSettings"
                component={Screen.NotificationSettings}
                options={{ title: t('notifications.title') }}
            />
            <RootStack.Screen
                name="ReferralProgram"
                component={Screen.ReferralProgram}
                options={{ title: t('referral.title') }}
            />
            <RootStack.Screen
                name="MySubscription"
                component={Screen.MySubscription}
                options={{ title: t('pro.subscription.sectionTitle') }}
            />
            <RootStack.Screen
                name="ContactUs"
                component={Screen.ContactUs}
                options={{ title: t('settings.contactUs') }}
            />
            <RootStack.Screen
                name="AdminPortal"
                component={Screen.AdminPortal}
                options={{ title: t('admin.portal.title') }}
            />
            <RootStack.Screen
                name="AdminDeletedUsers"
                component={Screen.AdminDeletedUsers}
                options={{ title: t('admin.deletedUsers.title') }}
            />
            <RootStack.Screen
                name="AdminOnboardingPreview"
                component={Screen.AdminOnboardingPreview}
                options={{ headerShown: false }}
            />
            <RootStack.Screen
                name="AdminErrors"
                component={Screen.AdminErrors}
                options={{ title: t('admin.errors.screenTitle') }}
            />
            <RootStack.Screen
                name="AdminSupportMessages"
                component={Screen.AdminSupportMessages}
                options={{ title: t('admin.supportMessages.title') }}
            />
            <RootStack.Screen
                name="AdminErrorDetail"
                component={Screen.AdminErrorDetail}
                options={({ route }) => ({
                    title:
                        (route.params as { title?: string } | undefined)?.title ??
                        t('admin.errors.detailTitle'),
                })}
            />
            <RootStack.Screen
                name="AdminErrorEvent"
                component={Screen.AdminErrorEvent}
                options={{ title: t('admin.errors.eventTitle') }}
            />
            <RootStack.Screen
                name="AdminMonetization"
                component={Screen.AdminMonetization}
                options={{ title: t('admin.monetization.portalRow') }}
            />

            <RootStack.Screen
                name="CreateGroup"
                component={Screen.CreateGroup}
                options={{ headerShown: false }}
            />
            <RootStack.Screen
                name="GroupPostCreateInvite"
                component={Screen.GroupPostCreateInvite}
                options={{ headerShown: false, presentation: 'modal' }}
            />
            <RootStack.Screen
                name="EditGroup"
                component={Screen.EditGroup}
                options={{ headerShown: false }}
            />

            <RootStack.Screen
                name="AddExpense"
                component={Screen.AddExpense}
                options={{ headerShown: false }}
            />
            <RootStack.Screen
                name="EditExpense"
                component={Screen.EditExpense}
                options={{ headerShown: false }}
            />
        </RootStack.Navigator>
    );
}
