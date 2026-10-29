import type { GroupWithMembers, SimplifiedInputsPayload } from '@cost-share/shared';
import {
    buildCaptureGroupsForLanguage,
    buildCaptureSimplifiedInputsForLanguage,
    barcelonaGroupNameForLanguage,
    captureDisplayNameForUser,
} from './ascCaptureLocaleData';

let activeLanguage = 'en';

export function setAscCaptureActiveLanguage(lang: string): void {
    activeLanguage = lang;
}

export function getAscCaptureActiveLanguage(): string {
    return activeLanguage;
}

export function activeCaptureGroups(): GroupWithMembers[] {
    return buildCaptureGroupsForLanguage(activeLanguage);
}

export function activeCaptureSimplifiedInputs(): SimplifiedInputsPayload {
    return buildCaptureSimplifiedInputsForLanguage(activeLanguage);
}

export function activeBarcelonaGroupName(): string {
    return barcelonaGroupNameForLanguage(activeLanguage);
}

export function activeCaptureYouLabel(): string {
    return captureDisplayNameForUser(activeLanguage, 'capture-user-u1');
}
