import { redirect } from 'next/navigation';
import { getLocale } from '@/lib/locale';
import { marketingLandingPath } from '@/lib/marketingSeo';

/** Fallback when middleware does not run (e.g. static export edge cases). */
export default async function Page() {
  const locale = await getLocale();
  redirect(marketingLandingPath(locale));
}
