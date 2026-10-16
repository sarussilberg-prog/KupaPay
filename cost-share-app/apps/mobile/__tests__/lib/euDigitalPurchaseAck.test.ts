import { isEuEeaUkChRegion } from '../../lib/euEeaUkChRegions';
import { requiresEuDigitalWithdrawalAck } from '../../lib/euDigitalPurchaseAck';

describe('euDigitalPurchaseAck', () => {
    it('detects EU/EEA/UK/CH regions', () => {
        expect(isEuEeaUkChRegion('DE')).toBe(true);
        expect(isEuEeaUkChRegion('IL')).toBe(false);
        expect(isEuEeaUkChRegion('US')).toBe(false);
    });

    it('requires waiver only in EU/EEA/UK/CH', () => {
        expect(requiresEuDigitalWithdrawalAck('FR')).toBe(true);
        expect(requiresEuDigitalWithdrawalAck('IL')).toBe(false);
    });
});
