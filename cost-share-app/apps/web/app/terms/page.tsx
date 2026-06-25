import LegalPage from '@/app/_components/LegalPage';

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  return <LegalPage slug="terms" langOverride={lang} />;
}
