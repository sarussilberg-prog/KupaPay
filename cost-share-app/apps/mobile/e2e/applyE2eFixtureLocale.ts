import type { Language } from '@cost-share/shared';
import { changeLanguage } from '../i18n';
import { seedE2eLayoutFixtures } from './seedE2eLayoutFixtures';

export async function applyE2eFixtureLocale(locale: Language): Promise<void> {
    await changeLanguage(locale);
    await seedE2eLayoutFixtures(locale);
}
