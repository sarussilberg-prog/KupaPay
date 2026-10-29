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
    travelGuidesIndexUrl,
} from '@/lib/marketingSeo';
import { TRAVEL_GUIDE_IDS } from '@/lib/travelGuidesPages';

type Props = Readonly<{
    locale: Language;
    t: Translations;
}>;

export default function TravelGuidesIndexLanding({ locale, t }: Props) {
    const index = t.travelGuides.index;
    const shared = t.travelGuides.shared;
    const pageUrl = travelGuidesIndexUrl(locale);

    return (
        <>
            <LandingStructuredData t={t} locale={locale} pageUrl={pageUrl} />
            <LandingHeader locale={locale} />
            <main id="main-content">
                <section className="bg-gradient-to-b from-white to-blue-50 pt-24 pb-16 px-4 text-center">
                    <div className="max-w-3xl mx-auto">
                        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-6 tracking-tight">
                            {index.hero.headline}
                        </h1>
                        <p className="text-lg sm:text-xl text-gray-500 mb-8 max-w-2xl mx-auto leading-relaxed">
                            {index.hero.subheadline}
                        </p>
                        <StoreDownloadBadges t={t} />
                    </div>
                </section>

                <section className="py-16 px-4 bg-white" aria-labelledby="guides-list-heading">
                    <div className="max-w-3xl mx-auto">
                        <p className="text-gray-600 text-sm leading-relaxed text-center mb-10">{index.intro}</p>
                        <h2 id="guides-list-heading" className="sr-only">
                            {index.listHeading}
                        </h2>
                        <ul className="grid gap-4 sm:grid-cols-2">
                            {TRAVEL_GUIDE_IDS.map((guideId) => {
                                const guide = t.travelGuides.guides[guideId];
                                return (
                                    <li key={guideId}>
                                        <Link
                                            href={travelGuidePath(locale, guideId)}
                                            className="block h-full rounded-2xl border border-gray-100 bg-gray-50 p-5 text-start hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
                                        >
                                            <h3 className="text-base font-semibold text-gray-900 mb-2">
                                                {guide.cardTitle}
                                            </h3>
                                            <p className="text-sm text-gray-600 leading-relaxed">{guide.cardTeaser}</p>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </section>

                <section className="py-16 px-4 bg-gray-50" aria-labelledby="tools-heading">
                    <div className="max-w-xl mx-auto text-center space-y-4">
                        <h2 id="tools-heading" className="text-2xl font-bold text-gray-900">
                            {shared.toolsTitle}
                        </h2>
                        <nav className="flex flex-wrap justify-center gap-4 text-sm">
                            <Link href={splitCalculatorPath(locale)} className="text-blue-600 font-medium hover:underline">
                                {shared.splitCalculatorLink}
                            </Link>
                            <Link
                                href={splitwiseComparisonPath(locale)}
                                className="text-blue-600 font-medium hover:underline"
                            >
                                {shared.splitwiseAlternativeLink}
                            </Link>
                            <Link href={marketingLandingPath(locale)} className="text-blue-600 font-medium hover:underline">
                                {shared.homeLink}
                            </Link>
                        </nav>
                        <StoreDownloadBadges t={t} />
                    </div>
                </section>
            </main>
            <LandingFooter t={t} locale={locale} />
        </>
    );
}
