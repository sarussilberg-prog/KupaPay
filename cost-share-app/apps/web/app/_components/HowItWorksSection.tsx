import type { Translations } from '@/lib/i18n';

interface Props {
  t: Translations;
}

export default function HowItWorksSection({ t }: Props) {
  return (
    <section className="py-24 px-4 bg-blue-50">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-16">
          {t.howItWorks.title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">
          {t.howItWorks.steps.map((step, index) => (
            <div key={step.title} className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-blue-500 text-white text-xl font-bold flex items-center justify-center mb-5 shadow-md shrink-0">
                {index + 1}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
