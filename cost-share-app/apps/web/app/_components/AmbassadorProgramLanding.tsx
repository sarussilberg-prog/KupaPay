import { isRtlLanguage } from '@cost-share/shared';
import LandingHeader from './LandingHeader';
import LandingFooter from './LandingFooter';
import LandingStructuredData from './LandingStructuredData';
import AmbassadorProgramForm from './AmbassadorProgramForm';
import type { Language, Translations } from '@/lib/i18n';
import { ambassadorProgramUrl } from '@/lib/marketingSeo';

type Props = Readonly<{
    locale: Language;
    t: Translations;
}>;

export default function AmbassadorProgramLanding({ locale, t }: Props) {
    const page = t.ambassadorProgram;
    const pageUrl = ambassadorProgramUrl(locale);
    const dir = isRtlLanguage(locale) ? ('rtl' as const) : ('ltr' as const);

    return (
        <>
            <LandingStructuredData t={t} locale={locale} pageUrl={pageUrl} />
            <LandingHeader locale={locale} />
            <main id="main-content" dir={dir}>
                <section className="bg-gradient-to-b from-white to-blue-50 pt-24 pb-12 px-4 text-center">
                    <div className="max-w-3xl mx-auto">
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
                            {page.hero.headline}
                        </h1>
                        <p className="text-lg sm:text-xl text-gray-500 mb-4 max-w-2xl mx-auto leading-relaxed">
                            {page.hero.subheadline}
                        </p>
                    </div>
                </section>

                <section className="py-12 px-4 bg-white" aria-labelledby="amb-benefits">
                    <div className="max-w-3xl mx-auto">
                        <h2 id="amb-benefits" className="text-2xl font-bold text-gray-900 mb-6 text-center">
                            {page.benefits.title}
                        </h2>
                        <ul className="space-y-4">
                            {page.benefits.items.map((item) => (
                                <li
                                    key={item.title}
                                    className="rounded-xl border border-gray-100 bg-gray-50 p-5 text-start"
                                >
                                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                                    <p className="text-gray-600 text-sm mt-1">{item.body}</p>
                                </li>
                            ))}
                        </ul>
                        <p className="text-xs text-gray-400 mt-8 text-center leading-relaxed">{page.disclaimer}</p>
                    </div>
                </section>

                <section className="py-12 px-4 bg-gray-50" aria-labelledby="amb-apply">
                    <div className="max-w-lg mx-auto">
                        <h2 id="amb-apply" className="sr-only">
                            {page.form.title}
                        </h2>
                        <AmbassadorProgramForm locale={locale} t={t} />
                    </div>
                </section>
            </main>
            <LandingFooter locale={locale} t={t} />
        </>
    );
}
