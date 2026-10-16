import { deviceTimezone } from '../../services/notificationPreferences.service';

describe('deviceTimezone', () => {
    it('returns a non-empty timezone string', () => {
        expect(typeof deviceTimezone()).toBe('string');
        expect(deviceTimezone().length).toBeGreaterThan(0);
    });
});
