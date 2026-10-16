import { CONTENT_SECURITY_POLICY } from '@cost-share/shared';
import vercelJson from '../../vercel.json';

describe('Expo web vercel.json CSP', () => {
    it('matches shared CONTENT_SECURITY_POLICY', () => {
        const headers = (vercelJson as { headers?: { source: string; headers: { key: string; value: string }[] }[] })
            .headers;
        expect(headers).toBeDefined();
        const csp = headers!
            .flatMap((block) => block.headers)
            .find((h) => h.key === 'Content-Security-Policy');
        expect(csp?.value).toBe(CONTENT_SECURITY_POLICY);
    });
});
