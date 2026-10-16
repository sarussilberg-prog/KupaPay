const mockSelect = jest.fn();
const mockEq1 = jest.fn();
const mockEq2 = jest.fn();
const mockEq3 = jest.fn();
const mockMaybeSingle = jest.fn();

const mockGetItem = jest.fn();
const mockSetItem = jest.fn();

const mockLoadStaticLegalDocument = jest.fn();

jest.mock('@cost-share/shared', () => {
    const actual = jest.requireActual('@cost-share/shared') as typeof import('@cost-share/shared');
    return {
        ...actual,
        loadStaticLegalDocument: (...args: unknown[]) => mockLoadStaticLegalDocument(...args),
    };
});

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({ select: mockSelect })),
    },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: (...args: unknown[]) => mockGetItem(...args),
        setItem: (...args: unknown[]) => mockSetItem(...args),
    },
}));

import { supabase } from '../../lib/supabase';
import { fetchLegalDocument } from '../../services/legal.service';
import { loadStaticLegalDocument, type LegalDocument } from '@cost-share/shared';

const ROW = {
    id: 'uuid-1',
    slug: 'terms' as const,
    locale: 'en' as const,
    version: '1.0.0',
    title: 'Terms of Service',
    content_md: '# Hello',
    effective_date: '2026-01-01',
    updated_at: '2026-05-23T10:00:00Z',
};

function buildChain(rowOrError: { data?: typeof ROW | null; error?: unknown }) {
    mockMaybeSingle.mockResolvedValue(rowOrError);
    mockEq3.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockEq2.mockReturnValue({ eq: mockEq3 });
    mockEq1.mockReturnValue({ eq: mockEq2 });
    mockSelect.mockReturnValue({ eq: mockEq1 });
}

beforeEach(() => {
    jest.clearAllMocks();
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
    mockLoadStaticLegalDocument.mockImplementation(
        (...args: Parameters<typeof loadStaticLegalDocument>) =>
            (jest.requireActual('@cost-share/shared') as typeof import('@cost-share/shared')).loadStaticLegalDocument(
                ...args,
            ),
    );
});

describe('fetchLegalDocument', () => {
    it('returns bundled static doc for French without calling Supabase', async () => {
        const doc = await fetchLegalDocument('terms', 'fr');
        expect(doc.locale).toBe('fr');
        expect(doc.title).toBe("Conditions d'utilisation");
        expect(doc.contentMd).toContain('sarussilberg@gmail.com');
        expect(supabase.from).not.toHaveBeenCalled();
        expect(mockSetItem).toHaveBeenCalledWith('legal:terms:fr', expect.any(String));
    });

    it('returns mapped doc from Supabase when static loader is unavailable', async () => {
        mockLoadStaticLegalDocument.mockReturnValue(null);

        buildChain({ data: ROW, error: null });
        const doc = await fetchLegalDocument('terms', 'en');

        expect(doc).toEqual<LegalDocument>({
            id: 'uuid-1',
            slug: 'terms',
            locale: 'en',
            version: '1.0.0',
            title: 'Terms of Service',
            contentMd: '# Hello',
            effectiveDate: '2026-01-01',
            updatedAt: '2026-05-23T10:00:00Z',
        });
    });

    it('falls back to cached doc when network errors and cache exists', async () => {
        mockLoadStaticLegalDocument.mockReturnValue(null);

        const cached: LegalDocument = {
            id: 'uuid-cached',
            slug: 'terms',
            locale: 'en',
            version: '1.0.0',
            title: 'Cached Terms',
            contentMd: '# Cached',
            effectiveDate: '2026-01-01',
            updatedAt: '2026-05-20T10:00:00Z',
        };
        mockGetItem.mockResolvedValue(JSON.stringify(cached));
        buildChain({ data: null, error: new Error('network down') });

        const doc = await fetchLegalDocument('terms', 'en');
        expect(doc).toEqual(cached);
    });
});
