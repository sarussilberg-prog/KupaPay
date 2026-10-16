/**
 * Supabase request budgets per screen initial load (mocked client).
 * Budgets: docs/SSOT/PERFORMANCE.md
 */

const mockFrom = jest.fn();
const mockRpc = jest.fn();
let supabaseCallCount = 0;

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: (...args: unknown[]) => {
            supabaseCallCount += 1;
            return mockFrom(...args);
        },
        rpc: (...args: unknown[]) => {
            supabaseCallCount += 1;
            return mockRpc(...args);
        },
        auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } }, error: null }),
        },
    },
}));

jest.mock('../../lib/auth', () => ({
    getCurrentUserId: jest.fn().mockResolvedValue('u1'),
}));

jest.mock('../../store', () => ({
    useAppStore: {
        getState: () => ({ currentUser: { id: 'u1', isAdmin: false } }),
    },
}));

import { fetchSimplifiedInputs } from '../../services/simplifiedDebts.service';
import { fetchGroupUnreadCounts } from '../../hooks/queries/useGroupUnreadCounts';
import { fetchExpenses } from '../../services/expenses.service';
import { refreshCurrentUserAdminFlag } from '../../services/users.service';
import { prefetchAddExpensePrerequisitesBatched } from '../../hooks/queries/prefetchAddExpenseForAllGroups';

/** Documented in docs/SSOT/PERFORMANCE.md */
const BUDGET = {
    groupsListCore: 4,
    groupDetail: 2,
    settings: 2,
} as const;

function resetCounter() {
    supabaseCallCount = 0;
    mockFrom.mockReset();
    mockRpc.mockReset();
}

function tableChain(result: { data: unknown; error: null }) {
    const api = {
        select: jest.fn(),
        eq: jest.fn(),
        in: jest.fn(),
        is: jest.fn(),
        order: jest.fn(),
    };
    api.select.mockReturnValue(api);
    api.eq.mockReturnValue(api);
    api.in.mockReturnValue(api);
    api.is.mockReturnValue(api);
    api.order.mockResolvedValue(result);
    return api;
}

describe('screen Supabase request budgets', () => {
    beforeEach(resetCounter);

    it('GroupsList core queries stay within budget', async () => {
        mockRpc
            .mockResolvedValueOnce({ data: { groups: [] }, error: null })
            .mockResolvedValueOnce({ data: [], error: null });
        mockFrom.mockImplementation((table: string) => {
            if (table === 'group_members') {
                return tableChain({ data: [], error: null });
            }
            if (table === 'profiles') {
                return tableChain({ data: [], error: null });
            }
            return tableChain({ data: [], error: null });
        });

        await fetchSimplifiedInputs();
        await fetchGroupUnreadCounts();
        prefetchAddExpensePrerequisitesBatched(['g1', 'g2']);
        await new Promise<void>(r => setTimeout(r, 0));

        expect(supabaseCallCount).toBeLessThanOrEqual(BUDGET.groupsListCore);
    });

    it('GroupDetail expenses fetch stays within budget', async () => {
        mockFrom.mockImplementation(() =>
            tableChain({ data: [], error: null }),
        );
        await fetchExpenses('g1');
        expect(supabaseCallCount).toBeLessThanOrEqual(BUDGET.groupDetail);
    });

    it('Settings admin refresh stays within budget', async () => {
        mockRpc.mockResolvedValue({ data: false, error: null });
        await refreshCurrentUserAdminFlag();
        expect(supabaseCallCount).toBeLessThanOrEqual(BUDGET.settings);
    });
});
