import {
    markPostLoginOnboardingComplete,
    markPreLoginOnboardingComplete,
} from '../lib/onboardingStorage';
import { seedAscCaptureApp } from '../screenshotDemo/seedAscCaptureApp';

export async function seedE2eLayoutFixtures(localeAppLanguage: string): Promise<void> {
    await markPreLoginOnboardingComplete();
    await markPostLoginOnboardingComplete();
    seedAscCaptureApp(localeAppLanguage);
}
