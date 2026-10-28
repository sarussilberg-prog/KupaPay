import React from 'react';
import { render } from '@testing-library/react-native';

const mockUseLegalDocument = jest.fn();

jest.mock('../../../hooks/queries/useLegalDocument', () => ({
    useLegalDocument: (...args: unknown[]) => mockUseLegalDocument(...args),
}));

jest.mock('react-native-markdown-display', () => ({
    __esModule: true,
    default: ({ children }: { children: string }) => {
        const ReactLazy = require('react');
        const { Text: RNText } = require('react-native');
        return ReactLazy.createElement(RNText, { testID: 'markdown-body' }, children);
    },
}));

jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, opts?: Record<string, unknown>) => {
            const dict: Record<string, string> = {
                'legal.termsTitle': 'תנאי שימוש',
                'legal.privacyTitle': 'מדיניות פרטיות',
                'legal.close': 'סגור',
                'legal.lastUpdated': 'עודכן: {{date}}',
                'legal.appVersion': 'גרסת אפליקציה {{version}}',
                'legal.understood': 'הבנתי',
            };
            let value = dict[key] ?? key;
            if (opts) {
                for (const [k, v] of Object.entries(opts)) {
                    value = value.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v));
                }
            }
            return value;
        },
        i18n: { language: 'he', changeLanguage: jest.fn(), dir: () => 'rtl' },
    }),
    initReactI18next: { type: '3rdParty', init: jest.fn() },
    Trans: ({ children }: { children: React.ReactNode }) => children,
}));

import { LegalDocumentSheet } from '../../../components/settings/LegalDocumentSheet';

describe('LegalDocumentSheet RTL markdown', () => {
    it('rewrites numbered headings before passing markdown to the renderer', () => {
        mockUseLegalDocument.mockReturnValue({
            data: {
                id: 'uuid-he',
                slug: 'terms' as const,
                locale: 'he' as const,
                version: '1.0.0',
                title: 'תנאי שימוש',
                contentMd: '## 10. כותרת סעיף\n\nטקסט גוף.',
                effectiveDate: '2026-01-01',
                updatedAt: '2026-05-23T10:00:00Z',
            },
            isLoading: false,
            isError: false,
            refetch: jest.fn(),
        });

        const { getByTestId } = render(
            <LegalDocumentSheet visible={true} slug="terms" onClose={() => {}} />,
        );

        const body = String(getByTestId('markdown-body').props.children);
        expect(body).toContain('## כותרת סעיף');
        expect(body).toContain('(10)');
        expect(body).not.toMatch(/^## 10\./m);
    });
});
