import {
    evaluateGroupsLayoutChecks,
    allChecksPass,
    measureAvatarToNameGap,
    measureBalanceToMenuGap,
    type LayoutFrame,
} from '../../lib/groupsLayoutDiagnostics';

const shellW = 358;

function frame(w: number, x = 0, height = 44): LayoutFrame {
    return { x, y: 0, width: w, height };
}

describe('groupsLayoutDiagnostics checks', () => {
    it('passes healthy LTR tab order and full-width row', () => {
        const rowW = shellW - 52;
        const avatarW = 40;
        const nameW = 148;
        const balanceW = 80;
        const menuW = 40;
        const gap = 12;
        const frames = {
            'group-card-shell': frame(shellW, 0, 72),
            'group-card-row': frame(rowW),
            'group-card-avatar': frame(avatarW, 0),
            'group-card-name': frame(nameW, avatarW + gap),
            'group-card-balance': frame(balanceW, avatarW + gap + nameW + gap),
            'group-card-menu': frame(menuW, avatarW + gap + nameW + gap + balanceW + gap),
            'tab-profile': frame(70, 8),
            'tab-activity': frame(70, 78),
            'tab-favorite': frame(70, shellW - 148),
            'tab-groups': frame(70, shellW - 78),
        };
        const checks = evaluateGroupsLayoutChecks(frames, { appRtl: false, windowWidth: 390 });
        expect(allChecksPass(checks)).toBe(true);
        expect(checks.find(c => c.id === 'group-card-shell-max-height')?.pass).toBe(true);
        expect(measureAvatarToNameGap(frames['group-card-avatar']!, frames['group-card-name']!, false)).toBe(
            gap,
        );
        expect(
            measureBalanceToMenuGap(frames['group-card-balance']!, frames['group-card-menu']!, false),
        ).toBe(gap);
    });

    it('passes healthy RTL mirror with tight avatar-to-name gap', () => {
        const rowW = shellW - 52;
        const avatarW = 40;
        const nameW = 148;
        const balanceW = 80;
        const menuW = 40;
        const gap = 12;
        const avatarX = rowW - avatarW;
        const nameX = avatarX - gap - nameW;
        const balanceX = nameX - gap - balanceW;
        const menuX = balanceX - gap - menuW;
        const frames = {
            'group-card-shell': frame(shellW, 0, 72),
            'group-card-row': frame(rowW),
            'group-card-avatar': frame(avatarW, avatarX),
            'group-card-name': frame(nameW, nameX),
            'group-card-balance': frame(balanceW, balanceX),
            'group-card-menu': frame(menuW, menuX),
            'tab-profile': frame(70, 8),
            'tab-activity': frame(70, 78),
            'tab-favorite': frame(70, shellW - 148),
            'tab-groups': frame(70, shellW - 78),
        };
        const checks = evaluateGroupsLayoutChecks(frames, { appRtl: true, windowWidth: 390 });
        expect(allChecksPass(checks)).toBe(true);
        expect(measureAvatarToNameGap(frames['group-card-avatar']!, frames['group-card-name']!, true)).toBe(
            gap,
        );
    });

    it('fails when card shell exceeds max height', () => {
        const frames = {
            'group-card-shell': frame(shellW, 0, 120),
            'group-card-row': frame(shellW - 52),
            'group-card-avatar': frame(40, 0),
            'group-card-menu': frame(40, 0),
        };
        const checks = evaluateGroupsLayoutChecks(frames, { appRtl: false, windowWidth: 390 });
        expect(checks.find(c => c.id === 'group-card-shell-max-height')?.pass).toBe(false);
    });

    it('fails squished RTL card + wrong tab corners (TestFlight-class layout)', () => {
        const frames = {
            'group-card-shell': frame(shellW, 0, 72),
            'group-card-row': frame(120, shellW - 128),
            'group-card-avatar': frame(48, shellW - 56),
            'group-card-name': frame(100, shellW / 2 - 50),
            'group-card-menu': frame(44, shellW / 2 - 22),
            'tab-profile': frame(70, shellW / 2 - 35),
            'tab-activity': frame(70, shellW - 78),
            'tab-favorite': frame(70, 8),
            'tab-groups': frame(70, 78),
        };
        const checks = evaluateGroupsLayoutChecks(frames, { appRtl: true, windowWidth: 390 });
        expect(allChecksPass(checks)).toBe(false);
        const failed = checks.filter(c => !c.pass).map(c => c.id);
        expect(failed).toEqual(
            expect.arrayContaining([
                'group-card-row-expands',
                'group-card-menu-not-centered-rtl',
                'group-card-avatar-name-gap-rtl',
                'tabbar-profile-leftmost-rtl',
                'tabbar-groups-rightmost-rtl',
            ]),
        );
    });
});
