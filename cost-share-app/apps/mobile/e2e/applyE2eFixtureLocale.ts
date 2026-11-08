import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from '@cost-share/shared';
import { changeLanguage, initializeLanguageForCapture } from '../i18n';
import { XX_LONG_LOCALE_CODE } from '../i18n/e2ePseudoLocale';
import { useAppStore } from '../store';
import { seedE2eLayoutFixtures } from './seedE2eLayoutFixtures';

const LANGUAGE_KEY = '@app_language';

/** Fixture probes: logical RTL via RtlLayoutProvider — no Updates.reloadAsync() (breaks Maestro). */
export async function applyE2eFixtureLocale(locale: Language): Promise<void> {
    await AsyncStorage.setItem(LANGUAGE_KEY, locale);
    await initializeLanguageForCapture(locale);
    await seedE2eLayoutFixtures(locale);
}

/** Fixture probes: apply xx-long i18n bundle without native RTL reload (Maestro-safe). */
export async function applyE2eFixturePseudoLocale(): Promise<void> {
    await changeLanguage(XX_LONG_LOCALE_CODE);
    await seedE2eLayoutFixtures(useAppStore.getState().language);
}
