import { buildWhatsAppShareUrl } from '../whatsapp';

describe('buildWhatsAppShareUrl', () => {
    it('encodes the message for wa.me', () => {
        const url = buildWhatsAppShareUrl('Hello & welcome https://kupa-pay.com/g/abc');
        expect(url).toBe(
            'https://wa.me/?text=Hello%20%26%20welcome%20https%3A%2F%2Fkupa-pay.com%2Fg%2Fabc',
        );
    });
});
