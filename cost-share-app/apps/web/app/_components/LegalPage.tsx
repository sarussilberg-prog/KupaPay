import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';
import { getLocale } from '@/lib/locale';
import { getTranslations } from '@/lib/i18n';
import LandingHeader from './LandingHeader';
import LandingFooter from './LandingFooter';
import type { LegalSlug } from '@cost-share/shared';

interface Props {
  slug: LegalSlug;
}

export default async function LegalPage({ slug }: Props) {
  const locale = await getLocale();
  const t = getTranslations(locale);
  const supabase = await createClient();

  const { data } = await supabase
    .from('legal_documents')
    .select('title, content_md, effective_date')
    .eq('slug', slug)
    .eq('locale', locale)
    .eq('is_published', true)
    .maybeSingle();

  return (
    <>
      <LandingHeader />
      <main className="max-w-2xl mx-auto px-4 py-16 min-h-[60vh]">
        {!data ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-6">{t.legal.notFound}</p>
            <Link href="/" className="text-blue-500 hover:underline">
              {t.legal.backHome}
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{data.title}</h1>
            {data.effective_date && (
              <p className="text-sm text-gray-400 mb-10">
                {t.legal.effectiveDate}
                {new Date(data.effective_date).toLocaleDateString(
                  locale === 'he' ? 'he-IL' : 'en-US',
                )}
              </p>
            )}
            <div className="prose prose-gray max-w-none">
              <ReactMarkdown>{data.content_md}</ReactMarkdown>
            </div>
          </>
        )}
      </main>
      <LandingFooter t={t} locale={locale} />
    </>
  );
}
