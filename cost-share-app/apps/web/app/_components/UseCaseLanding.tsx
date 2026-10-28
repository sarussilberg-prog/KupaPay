import Link from 'next/link';
import LandingHeader from './LandingHeader';
import LandingFooter from './LandingFooter';
import StoreDownloadBadges from './StoreDownloadBadges';
import UseCaseFaqStructuredData from './UseCaseFaqStructuredData';
import LandingStructuredData from './LandingStructuredData';
import type { Language, Translations } from '@/lib/i18n';
import {
    marketingLandingPath,
    splitCalculatorPath,
    useCasePath,
    useCaseUrl,
} from '@/lib/marketingSeo';
import { USE_CASE_IDS, type UseCaseId } from '@/lib/useCasePages';

type Props = Readonly<{
    locale: Language;
    useCaseId: UseCaseId;
    t: Translations;
}>;

export default function UseCaseLanding({ locale, useCaseId, t }: Props) {
    const page = t.useCases[useCaseId];
    const shared = t.useCaseShared;
    const pageUrl = useCaseUrl(locale, useCaseId);

    const otherUseCases = USE_CASE_IDS.filter((id) => id !== useCaseId);

    return (
        <>
            <LandingStructuredData t={t} locale={locale} pageUrl={pageUrl} />
            <UseCaseFaqStructuredData items={page.faq.items} />
            <LandingHeader locale={locale} />
            <main id="main-content">
                <section className="bg-gradient-to-b from-white to-blue-50 pt-24 pb-20 px-4 text-center">
                    <div className="max-w-3xl mx-auto">
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
                            {page.hero.headline}
                        </h1>
                        <p className="text-lg sm:text-xl text-gray-500 mb-10 max-w-xl mx-auto leading-relaxed">
                            {page.hero.subheadline}
                        </p>
                        <StoreDownloadBadges t={t} />
                    </div>
                </section>

                <section className="py-20 px-4 bg-white" aria-labelledby="benefits-heading">
                    <div className="max-w-4xl mx-auto">
                        <h2 id="benefits-heading" className="text-3xl font-bold text-center text-gray-900 mb-12">
                            {page.benefits.title}
                        </h2>
                        <ul className="grid gap-8 sm:grid-cols-2">
                            {page.benefits.items.map((item, index) => (
                                <li
                                    key={index}
                                    className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-start"
                                >
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
                                    <p className="text-gray-600 text-sm leading-relaxed">{item.description}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                <section className="py-20 px-4 bg-gray-50" aria-labelledby="how-heading">
                    <div className="max-w-3xl mx-auto">
                        <h2 id="how-heading" className="text-3xl font-bold text-center text-gray-900 mb-12">
                            {shared.howItWorksTitle}
                        </h2>
                        <ol className="space-y-8">
                            {page.howItWorks.steps.map((step, index) => (
                                <li key={index} className="flex gap-4 text-start">
                                    <span
                                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white font-bold"
                                        aria-hidden="true"
                                    >
                                        {index + 1}
                                    </span>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
                                        <p className="text-gray-600 text-sm leading-relaxed">{step.description}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section className="py-20 px-4 bg-white" aria-labelledby="faq-heading">
                    <div className="max-w-2xl mx-auto">
                        <h2 id="faq-heading" className="text-3xl font-bold text-center text-gray-900 mb-12">
                            {shared.faqTitle}
                        </h2>
                        <dl className="divide-y divide-gray-100 border-t border-gray-100">
                            {page.faq.items.map((item, index) => (
                                <div key={index} className="py-5 text-start">
                                    <dt className="font-medium text-gray-900 text-base mb-2">{item.question}</dt>
                                    <dd className="text-gray-500 text-sm leading-relaxed">{item.answer}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                </section>

                <section className="py-16 px-4 bg-gray-50" aria-labelledby="explore-heading">
                    <div className="max-w-3xl mx-auto text-center space-y-6">
                        <h2 id="explore-heading" className="text-2xl font-bold text-gray-900">
                            {shared.exploreTitle}
                        </h2>
                        <nav
                            className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-4 text-sm"
                            aria-label={shared.exploreTitle}
                        >
                            <Link
                                href={splitCalculatorPath(locale)}
                                className="text-blue-600 font-medium hover:underline"
                            >
                                {shared.splitCalculatorLink}
                            </Link>
                            <Link
                                href={marketingLandingPath(locale)}
                                className="text-blue-600 font-medium hover:underline"
                            >
                                {shared.mainLandingLink}
                            </Link>
                        </nav>
                        <div className="pt-4">
                            <p className="text-sm font-medium text-gray-700 mb-3">{shared.otherUseCasesTitle}</p>
                            <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2">
                                {otherUseCases.map((id) => (
                                    <li key={id}>
                                        <Link
                                            href={useCasePath(locale, id)}
                                            className="text-blue-600 hover:underline"
                                        >
                                            {t.useCases[id].navLabel}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>

                <section
                    className="py-20 px-4 bg-white border-t border-gray-100"
                    aria-labelledby="use-case-cta-heading"
                >
                    <div className="max-w-xl mx-auto text-center space-y-4">
                        <h2 id="use-case-cta-heading" className="text-2xl font-bold text-gray-900">
                            {page.cta.title}
                        </h2>
                        <p className="text-gray-600 leading-relaxed">{page.cta.body}</p>
                        <StoreDownloadBadges t={t} />
                    </div>
                </section>
            </main>
            <LandingFooter t={t} locale={locale} />
        </>
    );
}
