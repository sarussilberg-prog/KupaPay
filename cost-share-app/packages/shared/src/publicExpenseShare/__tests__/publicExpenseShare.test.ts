import { parsePublicExpenseShareWire } from '../parsePublicExpenseShareWire';
import { renderPublicExpenseShareHtml } from '../renderPublicExpenseShareHtml';

describe('public expense share (#401)', () => {
    it('parses ok wire', () => {
        const wire = parsePublicExpenseShareWire({
            ok: true,
            description: 'Dinner',
            amount: 40,
            currency: 'ILS',
            group_name: 'Trip',
            payer_name: 'Alex',
        });
        expect(wire.ok).toBe(true);
        expect(wire.description).toBe('Dinner');
    });

    it('renders OG html with description', () => {
        const html = renderPublicExpenseShareHtml({
            locale: 'en',
            token: 'AbCdEfGhIjKl',
            canonicalPath: '/e/AbCdEfGhIjKl',
            wire: {
                ok: true,
                description: 'Dinner',
                amount: 40,
                currency: 'ILS',
                group_name: 'Trip',
                payer_name: 'Alex',
            },
        });
        expect(html).toContain('og:description');
        expect(html).toContain('Dinner');
        expect(html).toContain('/e/AbCdEfGhIjKl');
    });
});
