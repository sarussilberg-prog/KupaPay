import type { Translations } from '@/lib/i18n';

interface Props {
  t: Translations;
}

export default function FeaturesSection({ t }: Props) {
  return (
    <section className="py-24 px-4 bg-white">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-14">
          {t.features.title}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {t.features.items.map((item) => (
            <div
              key={item.title}
              className="p-7 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow bg-white"
            >
              <div className="text-4xl mb-4">{item.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
