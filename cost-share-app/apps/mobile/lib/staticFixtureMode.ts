import { isAscScreenshotDemo } from './ascScreenshotDemo';
import { isE2eLayoutFixturesEnabled } from './e2eLayoutFixtures';

/** ASC store screenshots or Maestro layout fixtures — skip live API calls. */
export function usesStaticFixtureData(): boolean {
    return isAscScreenshotDemo() || isE2eLayoutFixturesEnabled();
}
