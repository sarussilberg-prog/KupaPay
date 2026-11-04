import { I18nManager, Platform, type LayoutRectangle } from 'react-native';
import {
    GROUP_CARD_MAX_AVATAR_TO_NAME_GAP,
    GROUP_CARD_MAX_BALANCE_TO_MENU_GAP,
    GROUP_CARD_MAX_SHELL_HEIGHT,
} from './groupsCardLayoutLimits';

export type LayoutFrame = Pick<LayoutRectangle, 'x' | 'y' | 'width' | 'height'>;

export type LayoutProbeId =
    | 'group-card-shell'
    | 'group-card-row'
    | 'group-card-avatar'
    | 'group-card-name'
    | 'group-card-member-count'
    | 'group-card-balance'
    | 'group-card-menu'
    | 'tabbar-row'
    | 'tab-profile'
    | 'tab-activity'
    | 'tab-favorite'
    | 'tab-groups';

export type I18nRtlSnapshot = {
    isRTL: boolean;
    doLeftAndRightSwap: boolean;
    allowRTL: boolean;
    platform: string;
};

export type GroupsLayoutDiagnosticPayload = {
    locale: string;
    appRtl: boolean;
    windowWidth: number;
    i18nManager: I18nRtlSnapshot;
    frames: Partial<Record<LayoutProbeId, LayoutFrame>>;
    checks: GroupsLayoutCheckResult[];
    capturedAt: string;
};

export type GroupsLayoutCheckResult = {
    id: string;
    pass: boolean;
    detail: string;
};

const probeStore: Partial<Record<LayoutProbeId, LayoutFrame>> = {};
let payloadListener: ((payload: GroupsLayoutDiagnosticPayload) => void) | null = null;

export function resetLayoutProbes(): void {
    for (const key of Object.keys(probeStore) as LayoutProbeId[]) {
        delete probeStore[key];
    }
}

export function recordLayoutProbe(id: LayoutProbeId, frame: LayoutFrame): void {
    probeStore[id] = frame;
    payloadListener?.(buildDiagnosticPayload());
}

export function subscribeLayoutDiagnostics(
    listener: (payload: GroupsLayoutDiagnosticPayload) => void,
): () => void {
    payloadListener = listener;
    listener(buildDiagnosticPayload());
    return () => {
        if (payloadListener === listener) payloadListener = null;
    };
}

/** Physical gap between avatar inner edge and name column start edge (pt). */
function measureAvatarToNameGap(
    avatar: LayoutFrame,
    name: LayoutFrame,
    appRtl: boolean,
): number {
    if (appRtl) {
        return avatar.x - (name.x + name.width);
    }
    return name.x - (avatar.x + avatar.width);
}

/** Physical gap between balance pill and overflow menu (pt). */
function measureBalanceToMenuGap(
    balance: LayoutFrame,
    menu: LayoutFrame,
    appRtl: boolean,
): number {
    if (appRtl) {
        return balance.x - (menu.x + menu.width);
    }
    return menu.x - (balance.x + balance.width);
}

export function snapshotI18nManager(): I18nRtlSnapshot {
    let doLeftAndRightSwap = false;
    try {
        doLeftAndRightSwap = I18nManager.doLeftAndRightSwapInRTL ?? I18nManager.isRTL;
    } catch {
        doLeftAndRightSwap = I18nManager.isRTL;
    }
    return {
        isRTL: I18nManager.isRTL,
        doLeftAndRightSwap,
        allowRTL: true,
        platform: Platform.OS,
    };
}

/** Maestro / CI: all checks must pass for healthy RTL groups + tab bar layout. */
export function evaluateGroupsLayoutChecks(
    frames: Partial<Record<LayoutProbeId, LayoutFrame>>,
    opts: { appRtl: boolean; windowWidth: number },
): GroupsLayoutCheckResult[] {
    const checks: GroupsLayoutCheckResult[] = [];
    const shell = frames['group-card-shell'];
    const row = frames['group-card-row'];
    const menu = frames['group-card-menu'];
    const avatar = frames['group-card-avatar'];
    const name = frames['group-card-name'];
    const balance = frames['group-card-balance'];

    if (shell && row) {
        const rowWidthRatio = row.width / shell.width;
        checks.push({
            id: 'group-card-row-expands',
            pass: rowWidthRatio >= 0.78,
            detail: `row.width/shell.width=${rowWidthRatio.toFixed(3)} (need ≥0.78)`,
        });
        checks.push({
            id: 'group-card-shell-max-height',
            pass: shell.height <= GROUP_CARD_MAX_SHELL_HEIGHT,
            detail: `shell.height=${shell.height.toFixed(1)} (need ≤${GROUP_CARD_MAX_SHELL_HEIGHT})`,
        });
    } else {
        checks.push({
            id: 'group-card-row-expands',
            pass: false,
            detail: 'missing shell or row frame',
        });
        checks.push({
            id: 'group-card-shell-max-height',
            pass: false,
            detail: 'missing shell or row frame',
        });
    }

    if (shell && menu && opts.appRtl) {
        const menuCenterX = menu.x + menu.width / 2;
        const shellCenterX = shell.width / 2;
        const menuNearTrailingEdge = menu.x + menu.width <= shell.width * 0.35;
        const menuNotCentered = Math.abs(menuCenterX - shellCenterX) > shell.width * 0.12;
        checks.push({
            id: 'group-card-menu-not-centered-rtl',
            pass: menuNearTrailingEdge && menuNotCentered,
            detail: `menu.x=${menu?.x?.toFixed(1)} menuCenter=${menuCenterX.toFixed(1)} shellW=${shell.width.toFixed(1)}`,
        });
    }

    if (shell && avatar && opts.appRtl) {
        const avatarCenterX = avatar.x + avatar.width / 2;
        const avatarInStartHalf = avatarCenterX >= shell.width * 0.45;
        checks.push({
            id: 'group-card-avatar-start-half-rtl',
            pass: avatarInStartHalf,
            detail: `avatarCenterX=${avatarCenterX.toFixed(1)} shellW=${shell.width.toFixed(1)}`,
        });
    }

    if (avatar && name) {
        const gap = measureAvatarToNameGap(avatar, name, opts.appRtl);
        const suffix = opts.appRtl ? 'rtl' : 'ltr';
        checks.push({
            id: `group-card-avatar-name-gap-${suffix}`,
            pass: gap >= -1 && gap <= GROUP_CARD_MAX_AVATAR_TO_NAME_GAP,
            detail: `avatar→name gap=${gap.toFixed(1)} (need 0–${GROUP_CARD_MAX_AVATAR_TO_NAME_GAP})`,
        });
        checks.push({
            id: `group-card-avatar-x-order-${suffix}`,
            pass: opts.appRtl ? avatar.x > name.x : avatar.x < name.x,
            detail: `avatar.x=${avatar.x.toFixed(1)} name.x=${name.x.toFixed(1)} (he: avatar.x > name.x)`,
        });
    }

    if (balance && menu) {
        const gap = measureBalanceToMenuGap(balance, menu, opts.appRtl);
        const suffix = opts.appRtl ? 'rtl' : 'ltr';
        checks.push({
            id: `group-card-balance-menu-gap-${suffix}`,
            pass: gap >= -1 && gap <= GROUP_CARD_MAX_BALANCE_TO_MENU_GAP,
            detail: `balance→menu gap=${gap.toFixed(1)} (need 0–${GROUP_CARD_MAX_BALANCE_TO_MENU_GAP})`,
        });
        checks.push({
            id: `group-card-menu-x-order-${suffix}`,
            pass: opts.appRtl ? menu.x < balance.x : menu.x > balance.x,
            detail: `menu.x=${menu.x.toFixed(1)} balance.x=${balance.x.toFixed(1)} (he: menu.x < balance.x)`,
        });
    }

    const tabProfile = frames['tab-profile'];
    const tabActivity = frames['tab-activity'];
    const tabGroups = frames['tab-groups'];
    const tabFavorite = frames['tab-favorite'];

    if (tabProfile && tabActivity && tabGroups && tabFavorite) {
        const leftmost = Math.min(tabProfile.x, tabActivity.x, tabGroups.x, tabFavorite.x);
        const rightmost = Math.max(
            tabProfile.x + tabProfile.width,
            tabActivity.x + tabActivity.width,
            tabGroups.x + tabGroups.width,
            tabFavorite.x + tabFavorite.width,
        );
        const tabSideSuffix = opts.appRtl ? 'rtl' : 'ltr';
        if (opts.appRtl) {
            checks.push({
                id: `tabbar-groups-leftmost-${tabSideSuffix}`,
                pass: Math.abs(tabGroups.x - leftmost) < 2,
                detail: `groups.x=${tabGroups.x.toFixed(1)} leftmost=${leftmost.toFixed(1)}`,
            });
            checks.push({
                id: `tabbar-profile-rightmost-${tabSideSuffix}`,
                pass: Math.abs(tabProfile.x + tabProfile.width - rightmost) < 2,
                detail: `profile.right=${(tabProfile.x + tabProfile.width).toFixed(1)} rightmost=${rightmost.toFixed(1)}`,
            });
        } else {
            checks.push({
                id: `tabbar-profile-leftmost-${tabSideSuffix}`,
                pass: Math.abs(tabProfile.x - leftmost) < 2,
                detail: `profile.x=${tabProfile.x.toFixed(1)} leftmost=${leftmost.toFixed(1)}`,
            });
            checks.push({
                id: `tabbar-groups-rightmost-${tabSideSuffix}`,
                pass: Math.abs(tabGroups.x + tabGroups.width - rightmost) < 2,
                detail: `groups.right=${(tabGroups.x + tabGroups.width).toFixed(1)} rightmost=${rightmost.toFixed(1)}`,
            });
        }
    }

    return checks;
}

export function allChecksPass(checks: GroupsLayoutCheckResult[]): boolean {
    return checks.length > 0 && checks.every(c => c.pass);
}

export function buildDiagnosticPayload(
    locale = 'unknown',
    appRtl = false,
    windowWidth = 0,
): GroupsLayoutDiagnosticPayload {
    const frames = { ...probeStore };
    const checks = evaluateGroupsLayoutChecks(frames, { appRtl, windowWidth });
    return {
        locale,
        appRtl,
        windowWidth,
        i18nManager: snapshotI18nManager(),
        frames,
        checks,
        capturedAt: new Date().toISOString(),
    };
}

export function diagnosticJson(payload: GroupsLayoutDiagnosticPayload): string {
    return JSON.stringify(payload, null, 0);
}
