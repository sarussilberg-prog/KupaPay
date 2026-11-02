import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Language } from '@cost-share/shared';
import { initializeLanguageForCapture } from '../i18n';
import { seedE2eLayoutFixtures } from './seedE2eLayoutFixtures';

const LANGUAGE_KEY = '@app_language';

/** Fixture probes: logical RTL via RtlLayoutProvider — no Updates.reloadAsync() (breaks Maestro). */
export async function applyE2eFixtureLocale(locale: Language): Promise<void> {
    await AsyncStorage.setItem(LANGUAGE_KEY, locale);
    await initializeLanguageForCapture(locale);
    await seedE2eLayoutFixtures(locale);
}
