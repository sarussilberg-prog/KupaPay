import {
    evaluateGroupsLayoutChecks,
    allChecksPass,
    type LayoutFrame,
} from '../../lib/groupsLayoutDiagnostics';

const shellW = 358;

function frame(w: number, x = 0): LayoutFrame {
    return { x, y: 0, width: w, height: 44 };
}

describe('groupsLayoutDiagnostics checks', () => {
    it('passes healthy LTR tab order and full-width row', () => {
        const frames = {
            'group-card-shell': frame(shellW),
            'group-card-row': frame(shellW - 52),
            'group-card-avatar': frame(48, 0),
            'group-card-menu': frame(44, 0),
            'tab-profile': frame(70, 8),
            'tab-activity': frame(70, 78),
            'tab-favorite': frame(70, shellW - 148),
            'tab-groups': frame(70, shellW - 78),
        };
        const checks = evaluateGroupsLayoutChecks(frames, { appRtl: false, windowWidth: 390 });
        expect(allChecksPass(checks)).toBe(true);
    });

    it('fails squished RTL card + wrong tab corners (TestFlight-class layout)', () => {
        const frames = {
            'group-card-shell': frame(shellW),
            'group-card-row': frame(120, shellW - 128),
            'group-card-avatar': frame(48, shellW - 56),
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
                'tabbar-profile-leftmost-rtl',
                'tabbar-groups-rightmost-rtl',
            ]),
        );
    });
});
