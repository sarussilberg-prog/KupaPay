import * as Localization from 'expo-localization';
import { isEuEeaUkChRegion } from './euEeaUkChRegions';

export function deviceRegionCode(): string | null {
    const region = Localization.getLocales()[0]?.regionCode;
    if (!region) return null;
    return region.toUpperCase();
}

/** EU/EEA/UK/CH consumers must acknowledge loss of 14-day withdrawal before digital delivery. */
export function requiresEuDigitalWithdrawalAck(regionCode?: string | null): boolean {
    return isEuEeaUkChRegion(regionCode ?? deviceRegionCode());
}
