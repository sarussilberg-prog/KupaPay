import { getLocale } from '@/lib/locale';
import { getTranslations } from '@/lib/i18n';
import LandingHeader from './_components/LandingHeader';
import HeroSection from './_components/HeroSection';
import FeaturesSection from './_components/FeaturesSection';
import HowItWorksSection from './_components/HowItWorksSection';
import FAQSection from './_components/FAQSection';
import LandingFooter from './_components/LandingFooter';

// TODO: Uncomment AppPreviewSection when iPhone screenshots are available
// import AppPreviewSection from './_components/AppPreviewSection';

// TODO: Uncomment SocialProofSection when real user metrics are available
// import SocialProofSection from './_components/SocialProofSection';

export default async function Page() {
  const locale = await getLocale();
  const t = getTranslations(locale);

  return (
    <>
      <LandingHeader />
      <main>
        <HeroSection t={t} />
        <FeaturesSection t={t} />
        <HowItWorksSection t={t} />
        {/* <AppPreviewSection t={t} /> */}
        {/* <SocialProofSection t={t} /> */}
        <FAQSection t={t} />
      </main>
      <LandingFooter t={t} locale={locale} />
    </>
  );
}
