import LandingHeader from './LandingHeader';
import HeroSection from './HeroSection';
import FeaturesSection from './FeaturesSection';
import HowItWorksSection from './HowItWorksSection';
import FAQSection from './FAQSection';
import LandingFooter from './LandingFooter';
import LandingStructuredData from './LandingStructuredData';
import { getTranslations, type Language } from '@/lib/i18n';
import { marketingLandingUrl } from '@/lib/marketingSeo';

type Props = Readonly<{
    locale: Language;
}>;

export default function LandingPage({ locale }: Props) {
    const t = getTranslations(locale);
    const pageUrl = marketingLandingUrl(locale);

    return (
        <>
            <LandingStructuredData t={t} locale={locale} pageUrl={pageUrl} />
            <LandingHeader locale={locale} />
            <main id="main-content">
                <HeroSection t={t} />
                <FeaturesSection t={t} />
                <HowItWorksSection t={t} />
                <FAQSection t={t} />
            </main>
            <LandingFooter t={t} locale={locale} />
        </>
    );
}
