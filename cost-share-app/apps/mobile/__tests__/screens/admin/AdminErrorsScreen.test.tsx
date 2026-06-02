const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
    useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }),
    useRoute: () => ({ params: {} }),
    useFocusEffect: jest.fn(),
    useIsFocused: () => true,
}));

const mockInvoke = jest.fn();
jest.mock('../../../lib/supabase', () => ({
    supabase: {
        functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    },
}));

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminErrorsScreen } from '../../../screens/admin/AdminErrorsScreen';

function renderWithQuery(ui: React.ReactElement) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const sampleIssue = {
    id: 'iss-1',
    shortId: 'KUPA-1',
    title: 'TypeError: x is undefined',
    level: 'error',
    status: 'unresolved',
    count: '12',
    userCount: 4,
    firstSeen: '2026-06-01T00:00:00Z',
    lastSeen: '2026-06-02T00:00:00Z',
    culprit: 'expenses.service.ts:120',
    metadata: {},
};

beforeEach(() => {
    mockInvoke.mockReset();
    mockNavigate.mockReset();
});

describe('AdminErrorsScreen', () => {
    it('renders the issue list from the stubbed response', async () => {
        mockInvoke.mockResolvedValue({ data: { ok: true, data: [sampleIssue] }, error: null });
        const { getByTestId } = renderWithQuery(<AdminErrorsScreen />);
        await waitFor(() => expect(getByTestId('admin-error-row-iss-1')).toBeTruthy());
    });

    it('navigates to AdminErrorDetail with the issue id on row press', async () => {
        mockInvoke.mockResolvedValue({ data: { ok: true, data: [sampleIssue] }, error: null });
        const { getByTestId } = renderWithQuery(<AdminErrorsScreen />);
        await waitFor(() => getByTestId('admin-error-row-iss-1'));
        fireEvent.press(getByTestId('admin-error-row-iss-1'));
        expect(mockNavigate).toHaveBeenCalledWith(
            'AdminErrorDetail',
            expect.objectContaining({ issueId: 'iss-1' }),
        );
    });

    it('re-invokes the proxy when the environment filter changes', async () => {
        mockInvoke.mockResolvedValue({ data: { ok: true, data: [] }, error: null });
        const { getByTestId } = renderWithQuery(<AdminErrorsScreen />);
        await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
        const firstCount = mockInvoke.mock.calls.length;

        await act(async () => {
            fireEvent.press(getByTestId('filter-env-prod'));
        });

        await waitFor(() => expect(mockInvoke.mock.calls.length).toBeGreaterThan(firstCount));
        const lastCall = mockInvoke.mock.calls[mockInvoke.mock.calls.length - 1];
        expect(lastCall[0]).toBe('admin-sentry-proxy');
        expect(lastCall[1].body.environment).toBe('prod');
    });

    it('shows the failed state when the proxy rejects', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('proxy boom') });
        const { getByTestId } = renderWithQuery(<AdminErrorsScreen />);
        // The hook configures retry: 1 with ~1s backoff, so the error state appears
        // after the retry resolves. Default findByTestId timeout (1s) is too short.
        await waitFor(() => expect(getByTestId('admin-errors-failed')).toBeTruthy(), {
            timeout: 5000,
        });
    });
});
