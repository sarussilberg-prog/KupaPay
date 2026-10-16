/** CI / Maestro store screenshot mode — skips auth and Supabase boot. */
export function isAscScreenshotDemo(): boolean {
  return process.env.EXPO_PUBLIC_ASC_SCREENSHOT_DEMO === 'true';
}

export function ascScreenshotLocale(): string | undefined {
  const raw = process.env.EXPO_PUBLIC_SCREENSHOT_LOCALE?.trim();
  return raw || undefined;
}
