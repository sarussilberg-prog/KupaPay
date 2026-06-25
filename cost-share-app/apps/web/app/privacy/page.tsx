import LegalPage from '@/app/_components/LegalPage';

export default async function PrivacyPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  return <LegalPage slug="privacy" langOverride={lang} />;
}
