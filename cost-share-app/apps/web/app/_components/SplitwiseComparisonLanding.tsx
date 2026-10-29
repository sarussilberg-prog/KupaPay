import Link from 'next/link';
import LandingHeader from './LandingHeader';
import LandingFooter from './LandingFooter';
import StoreDownloadBadges from './StoreDownloadBadges';
import UseCaseFaqStructuredData from './UseCaseFaqStructuredData';
import LandingStructuredData from './LandingStructuredData';
import type { Language, Translations } from '@/lib/i18n';
import { marketingLandingPath, splitCalculatorPath, splitwiseComparisonUrl } from '@/lib/marketingSeo';
import { SPLITWISE_COMPARISON_AS_OF } from '@/lib/splitwiseComparisonPages';

type Props = Readonly<{
    locale: Language;
    t: Translations;
}>;

export default function SplitwiseComparisonLanding({ locale, t }: Props) {
    const page = t.splitwiseComparison;
    const pageUrl = splitwiseComparisonUrl(locale);
    const asOfLine = page.table.asOfLabel.replace('{date}', SPLITWISE_COMPARISON_AS_OF);

    return (
        <>
            <LandingStructuredData t={t} locale={locale} pageUrl={pageUrl} />
            <UseCaseFaqStructuredData items={page.faq.items} />
            <LandingHeader locale={locale} />
            <main id="main-content">
                <section className="bg-gradient-to-b from-white to-blue-50 pt-24 pb-16 px-4 text-center">
                    <div className="max-w-3xl mx-auto">
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
                            {page.hero.headline}
                        </h1>
                        <p className="text-lg sm:text-xl text-gray-500 mb-8 max-w-2xl mx-auto leading-relaxed">
                            {page.hero.subheadline}
                        </p>
                        <StoreDownloadBadges t={t} />
                    </div>
                </section>

                <section className="py-16 px-4 bg-white" aria-labelledby="comparison-heading">
                    <div className="max-w-4xl mx-auto">
                        <h2 id="comparison-heading" className="text-3xl font-bold text-center text-gray-900 mb-3">
                            {page.table.title}
                        </h2>
                        <p className="text-center text-sm text-gray-500 mb-8">{asOfLine}</p>
                        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                            <table className="w-full min-w-[min(100%,20rem)] border-collapse text-sm text-start">
                                <caption className="sr-only">{page.table.caption}</caption>
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th scope="col" className="py-3 pe-4 font-semibold text-gray-900 align-bottom">
                                            {page.table.featureColumn}
                                        </th>
                                        <th scope="col" className="py-3 px-3 font-semibold text-gray-900 align-bottom">
                                            {page.table.kupapayColumn}
                                        </th>
                                        <th scope="col" className="py-3 ps-3 font-semibold text-gray-900 align-bottom">
                                            {page.table.splitwiseColumn}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {page.table.rows.map((row, index) => (
                                        <tr key={index} className="border-b border-gray-100">
                                            <th scope="row" className="py-4 pe-4 font-medium text-gray-900 align-top">
                                                {row.feature}
                                            </th>
                                            <td className="py-4 px-3 text-gray-600 align-top">{row.kupapay}</td>
                                            <td className="py-4 ps-3 text-gray-600 align-top">{row.splitwise}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-8 text-xs text-gray-400 leading-relaxed text-center max-w-2xl mx-auto">
                            {page.disclaimer}
                        </p>
                    </div>
                </section>

                <section className="py-16 px-4 bg-gray-50" aria-labelledby="fit-heading">
                    <div className="max-w-3xl mx-auto">
                        <h2 id="fit-heading" className="text-2xl font-bold text-center text-gray-900 mb-10">
                            {page.whenToUse.title}
                        </h2>
                        <ul className="space-y-4 text-start">
                            {page.whenToUse.items.map((item, index) => (
                                <li
                                    key={index}
                                    className="rounded-xl border border-gray-100 bg-white p-5 text-gray-600 text-sm leading-relaxed"
                                >
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                <section className="py-16 px-4 bg-white" aria-labelledby="faq-heading">
                    <div className="max-w-2xl mx-auto">
                        <h2 id="faq-heading" className="text-3xl font-bold text-center text-gray-900 mb-12">
                            {page.faq.title}
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

                <section className="py-16 px-4 bg-blue-50 text-center">
                    <div className="max-w-xl mx-auto space-y-4">
                        <h2 className="text-2xl font-bold text-gray-900">{page.cta.title}</h2>
                        <p className="text-gray-600 text-sm leading-relaxed">{page.cta.body}</p>
                        <StoreDownloadBadges t={t} />
                        <nav className="flex flex-wrap justify-center gap-4 text-sm pt-4">
                            <Link href={marketingLandingPath(locale)} className="text-blue-600 font-medium hover:underline">
                                {t.useCaseShared.mainLandingLink}
                            </Link>
                            <Link href={splitCalculatorPath(locale)} className="text-blue-600 font-medium hover:underline">
                                {t.useCaseShared.splitCalculatorLink}
                            </Link>
                        </nav>
                    </div>
                </section>
            </main>
            <LandingFooter t={t} locale={locale} />
        </>
    );
}
