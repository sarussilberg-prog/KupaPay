/**
 * Pro trial end reminder — local scheduled notification + server registration fallback.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import i18n from '../i18n';
import { KUPAPAY_PRO_ENABLED } from '../lib/featureFlags';
import {
    computeTrialReminderDate,
    PRO_TRIAL_REMINDER_NOTIFICATION_ID,
    resolveTrialEndDate,
} from '../lib/proTrialReminder';
import { ensureAndroidChannel, requestPermission } from '../lib/pushNotifications';
import { registerProTrialReminderOnServer } from './proEntitlements.service';

export type CustomerInfoTrialSlice = {
    periodType: string | null;
    expirationDate: string | null;
    originalPurchaseDate: string | null;
};

export function readProTrialSliceFromCustomerInfo(
    customerInfo: {
        entitlements: { active: Record<string, CustomerInfoTrialSlice | undefined> };
    },
    entitlementId: string,
): CustomerInfoTrialSlice | null {
    const ent = customerInfo.entitlements.active[entitlementId];
    if (!ent) return null;
    return {
        periodType: ent.periodType ?? null,
        expirationDate: ent.expirationDate ?? null,
        originalPurchaseDate: ent.originalPurchaseDate ?? null,
    };
}

export async function cancelProTrialReminderNotification(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
        await Notifications.cancelScheduledNotificationAsync(PRO_TRIAL_REMINDER_NOTIFICATION_ID);
    } catch {
        /* native module unavailable */
    }
}

async function scheduleLocalProTrialReminder(trialEnd: Date): Promise<boolean> {
    if (Platform.OS === 'web' || !KUPAPAY_PRO_ENABLED) return false;

    const triggerAt = computeTrialReminderDate(trialEnd);
    if (!triggerAt) return false;

    const granted = await requestPermission();
    if (!granted) return false;

    await ensureAndroidChannel();
    await cancelProTrialReminderNotification();

    const title = i18n.t('pro.trialReminder.title');
    const body = i18n.t('pro.trialReminder.body');

    await Notifications.scheduleNotificationAsync({
        identifier: PRO_TRIAL_REMINDER_NOTIFICATION_ID,
        content: {
            title,
            body,
            data: { kind: 'pro_trial_reminder' },
        },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerAt,
        },
    });
    return true;
}

export async function syncProTrialReminder(input: {
    entitlementId: string;
    customerInfo: {
        entitlements: { active: Record<string, CustomerInfoTrialSlice | undefined> };
    };
}): Promise<void> {
    if (!KUPAPAY_PRO_ENABLED) return;

    const slice = readProTrialSliceFromCustomerInfo(input.customerInfo, input.entitlementId);
    if (!slice) {
        await cancelProTrialReminderNotification();
        await registerProTrialReminderOnServer(null);
        return;
    }

    const purchasedAtMs = slice.originalPurchaseDate
        ? Date.parse(slice.originalPurchaseDate)
        : null;

    const trialEnd = resolveTrialEndDate({
        periodType: slice.periodType,
        expirationDate: slice.expirationDate,
        purchasedAtMs: Number.isFinite(purchasedAtMs) ? purchasedAtMs : null,
    });

    if (!trialEnd) {
        await cancelProTrialReminderNotification();
        await registerProTrialReminderOnServer(null);
        return;
    }

    await registerProTrialReminderOnServer(trialEnd.toISOString());
    const localScheduled = await scheduleLocalProTrialReminder(trialEnd);
    if (!localScheduled) {
        // Server dispatch (pro-trial-reminder-dispatch cron) sends push when local fails.
    }
}
