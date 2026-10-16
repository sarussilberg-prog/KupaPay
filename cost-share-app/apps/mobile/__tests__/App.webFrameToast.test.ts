import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Web: Toast must render inside WebFrame so it stays within the phone column.
 * Regression for KI-011 / #105.
 */
describe('App.tsx WebFrame + Toast layout', () => {
    const src = readFileSync(join(__dirname, '../App.tsx'), 'utf8');

    it('keeps Toast inside WebFrame for the authenticated tree', () => {
        const authBlock = src.slice(src.indexOf('<AuthenticatedAppGate'));
        expect(authBlock).toMatch(/<Toast config=\{toastConfig\}/);
        expect(authBlock.indexOf('<Toast')).toBeLessThan(authBlock.indexOf('</WebFrame>'));
    });

    it('keeps Toast inside WebFrame for the logged-out tree', () => {
        const loginIdx = src.indexOf('<LoginScreen');
        expect(loginIdx).toBeGreaterThan(-1);
        const block = src.slice(loginIdx);
        expect(block).toMatch(/<Toast config=\{toastConfig\}/);
        expect(block.indexOf('<Toast')).toBeLessThan(block.indexOf('</WebFrame>'));
    });
});
