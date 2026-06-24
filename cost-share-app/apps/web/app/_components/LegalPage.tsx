import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { getLocale } from '@/lib/locale';
import { getTranslations } from '@/lib/i18n';
import LandingHeader from './LandingHeader';
import LandingFooter from './LandingFooter';
import { APP_VERSION, type LegalSlug } from '@cost-share/shared';

// Legal pages are public — use a plain anon client with no session/cookie handling.
// The legal_documents table has anon-readable RLS for published rows.
function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  );
}

interface Props {
  slug: LegalSlug;
}

export default async function LegalPage({ slug }: Props) {
  const locale = await getLocale();
  const t = getTranslations(locale);
  const supabase = createAnonClient();

  const { data } = await supabase
    .from('legal_documents')
    .select('title, content_md, effective_date')
    .eq('slug', slug)
    .eq('locale', locale)
    .eq('is_published', true)
    .maybeSingle();

  const isRtl = locale === 'he';
  const dir = isRtl ? ('rtl' as const) : ('ltr' as const);
  const textAlign = isRtl ? 'text-right' : 'text-left';

  return (
    <>
      <LandingHeader />
      <main className="max-w-2xl mx-auto px-4 py-16 min-h-[60vh]" dir={dir}>
        {!data ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-6">{t.legal.notFound}</p>
            <Link href="/" className="text-blue-500 hover:underline">
              {t.legal.backHome}
            </Link>
          </div>
        ) : (
          <>
            <h1 className={`text-3xl font-bold text-gray-900 mb-2 ${textAlign}`}>{data.title}</h1>
            {data.effective_date && (
              <p className={`text-sm text-gray-400 mb-1 ${textAlign}`}>
                {t.legal.effectiveDate}
                {new Date(data.effective_date).toLocaleDateString(
                  locale === 'he' ? 'he-IL' : 'en-US',
                )}
              </p>
            )}
            <p className={`text-sm text-gray-400 mb-10 ${textAlign}`}>
              {t.legal.appVersion}
              {APP_VERSION}
            </p>
            <div className={`prose prose-gray max-w-none ${textAlign}`} dir={dir}>
              <ReactMarkdown>{data.content_md}</ReactMarkdown>
            </div>
          </>
        )}
      </main>
      <LandingFooter t={t} locale={locale} />
    </>
  );
}
