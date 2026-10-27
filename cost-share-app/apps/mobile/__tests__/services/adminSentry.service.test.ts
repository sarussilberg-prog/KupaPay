const mockInvoke = jest.fn();

jest.mock('../../lib/supabase', () => ({
    supabase: {
        functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    },
}));

import {
    AdminSentryProxyError,
    fetchSentryIssues,
} from '../../services/adminSentry.service';

beforeEach(() => {
    mockInvoke.mockReset();
});

describe('adminSentry.service', () => {
    it('returns issues when proxy responds ok', async () => {
        mockInvoke.mockResolvedValue({
            data: { ok: true, data: [{ id: '1', shortId: 'X-1', title: 't' }] },
            error: null,
        });
        const rows = await fetchSentryIssues({ environment: 'dev' });
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe('1');
    });

    it('throws AdminSentryProxyError when body ok is false', async () => {
        mockInvoke.mockResolvedValue({
            data: {
                ok: false,
                error: 'forbidden',
                status: 403,
            },
            error: null,
        });
        await expect(fetchSentryIssues({ environment: 'dev' })).rejects.toBeInstanceOf(
            AdminSentryProxyError,
        );
        await expect(fetchSentryIssues({ environment: 'dev' })).rejects.toMatchObject({
            code: 'forbidden',
        });
    });

    it('parses JSON error body from FunctionsHttpError context', async () => {
        const response = new Response(
            JSON.stringify({
                ok: false,
                error: 'sentry_not_configured',
                missing: ['SENTRY_API_TOKEN'],
            }),
            { status: 503 },
        );
        mockInvoke.mockResolvedValue({
            data: null,
            error: { message: 'Edge Function returned a non-2xx status code', context: response },
        });
        try {
            await fetchSentryIssues({ environment: 'dev' });
            throw new Error('expected throw');
        } catch (e) {
            expect(e).toBeInstanceOf(AdminSentryProxyError);
            expect((e as AdminSentryProxyError).code).toBe('sentry_not_configured');
            expect((e as AdminSentryProxyError).missing).toEqual(['SENTRY_API_TOKEN']);
        }
    });
});
