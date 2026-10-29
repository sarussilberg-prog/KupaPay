import Link from 'next/link';
import LandingHeader from './LandingHeader';
import LandingFooter from './LandingFooter';
import StoreDownloadBadges from './StoreDownloadBadges';
import LandingStructuredData from './LandingStructuredData';
import type { Language, Translations } from '@/lib/i18n';
import {
    marketingLandingPath,
    splitCalculatorPath,
    splitwiseComparisonPath,
    travelGuidePath,
    travelGuideUrl,
    travelGuidesIndexPath,
    useCasePath,
} from '@/lib/marketingSeo';
import { TRAVEL_GUIDE_IDS, type TravelGuideId } from '@/lib/travelGuidesPages';

type Props = Readonly<{
    locale: Language;
    guideId: TravelGuideId;
    t: Translations;
}>;

export default function TravelGuideArticleLanding({ locale, guideId, t }: Props) {
    const page = t.travelGuides.guides[guideId];
    const shared = t.travelGuides.shared;
    const pageUrl = travelGuideUrl(locale, guideId);
    const related = TRAVEL_GUIDE_IDS.filter((id) => id !== guideId).slice(0, 3);

    return (
        <>
            <LandingStructuredData t={t} locale={locale} pageUrl={pageUrl} />
            <LandingHeader locale={locale} />
            <main id="main-content">
                <article className="pt-24 pb-8 px-4 bg-gradient-to-b from-white to-blue-50">
                    <div className="max-w-3xl mx-auto text-center">
                        <p className="mb-4 text-sm">
                            <Link
                                href={travelGuidesIndexPath(locale)}
                                className="text-blue-600 font-medium hover:underline"
                            >
                                {shared.backToIndex}
                            </Link>
                        </p>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-5 tracking-tight">
                            {page.hero.headline}
                        </h1>
                        <p className="text-lg text-gray-500 mb-8 leading-relaxed">{page.hero.subheadline}</p>
                    </div>
                </article>

                <div className="max-w-3xl mx-auto px-4 pb-16">
                    <p className="text-gray-600 text-sm leading-relaxed mb-10 text-start">{page.intro}</p>
                    <section aria-labelledby="tips-heading">
                        <h2 id="tips-heading" className="text-2xl font-bold text-gray-900 mb-6 text-start">
                            {shared.tipsHeading}
                        </h2>
                        <ul className="space-y-6">
                            {page.tips.map((tip) => (
                                <li
                                    key={tip.title}
                                    className="rounded-2xl border border-gray-100 bg-white p-5 text-start shadow-sm"
                                >
                                    <h3 className="text-base font-semibold text-gray-900 mb-2">{tip.title}</h3>
                                    <p className="text-sm text-gray-600 leading-relaxed">{tip.body}</p>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section className="mt-14 rounded-2xl border border-blue-100 bg-blue-50 p-6 text-center" aria-labelledby="cta-heading">
                        <h2 id="cta-heading" className="text-xl font-bold text-gray-900 mb-3">
                            {shared.ctaTitle}
                        </h2>
                        <p className="text-sm text-gray-600 leading-relaxed mb-5">{shared.ctaBody}</p>
                        <StoreDownloadBadges t={t} />
                        <nav className="flex flex-wrap justify-center gap-4 text-sm pt-5">
                            <Link href={splitCalculatorPath(locale)} className="text-blue-600 font-medium hover:underline">
                                {shared.splitCalculatorLink}
                            </Link>
                            <Link href={useCasePath(locale, 'trip')} className="text-blue-600 font-medium hover:underline">
                                {shared.tripExpensesLink}
                            </Link>
                            <Link
                                href={splitwiseComparisonPath(locale)}
                                className="text-blue-600 font-medium hover:underline"
                            >
                                {shared.splitwiseAlternativeLink}
                            </Link>
                        </nav>
                    </section>

                    <section className="mt-12" aria-labelledby="related-heading">
                        <h2 id="related-heading" className="text-lg font-bold text-gray-900 mb-4 text-start">
                            {shared.relatedGuidesTitle}
                        </h2>
                        <ul className="flex flex-col gap-3 text-sm text-start">
                            {related.map((id) => (
                                <li key={id}>
                                    <Link href={travelGuidePath(locale, id)} className="text-blue-600 hover:underline">
                                        {t.travelGuides.guides[id].cardTitle}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <p className="mt-10 text-xs text-gray-400 leading-relaxed text-center">
                        <Link href={marketingLandingPath(locale)} className="hover:text-gray-600">
                            {shared.homeLink}
                        </Link>
                    </p>
                </div>
            </main>
            <LandingFooter t={t} locale={locale} />
        </>
    );
}
