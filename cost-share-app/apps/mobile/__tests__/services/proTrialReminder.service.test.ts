import * as Notifications from 'expo-notifications';
import { syncProTrialReminder } from '../../services/proTrialReminder.service';
import { registerProTrialReminderOnServer } from '../../services/proEntitlements.service';

jest.mock('../../lib/featureFlags', () => ({
    KUPAPAY_PRO_ENABLED: true,
}));

jest.mock('../../services/proEntitlements.service', () => ({
    registerProTrialReminderOnServer: jest.fn().mockResolvedValue(undefined),
}));

describe('syncProTrialReminder', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('schedules local notification when in TRIAL with expiration', async () => {
        await syncProTrialReminder({
            entitlementId: 'pro',
            customerInfo: {
                entitlements: {
                    active: {
                        pro: {
                            periodType: 'TRIAL',
                            expirationDate: '2030-01-10T12:00:00.000Z',
                            originalPurchaseDate: '2030-01-03T12:00:00.000Z',
                        },
                    },
                },
            },
        });

        expect(registerProTrialReminderOnServer).toHaveBeenCalledWith('2030-01-10T12:00:00.000Z');
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
    });

    it('cancels when entitlement inactive', async () => {
        await syncProTrialReminder({
            entitlementId: 'pro',
            customerInfo: { entitlements: { active: {} } },
        });

        expect(registerProTrialReminderOnServer).toHaveBeenCalledWith(null);
        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalled();
    });
});
