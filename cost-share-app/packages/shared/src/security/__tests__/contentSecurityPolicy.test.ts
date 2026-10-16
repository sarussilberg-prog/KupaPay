import { CONTENT_SECURITY_POLICY } from '../contentSecurityPolicy';

describe('CONTENT_SECURITY_POLICY', () => {
    it('includes websocket and blob sources used by Expo web + Supabase', () => {
        expect(CONTENT_SECURITY_POLICY).toContain('wss:');
        expect(CONTENT_SECURITY_POLICY).toContain('worker-src');
        expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
    });
});
