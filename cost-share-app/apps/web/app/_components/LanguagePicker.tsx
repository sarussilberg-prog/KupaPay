'use client';

import {
  LANGUAGE_NATIVE_LABELS,
  SUPPORTED_LANGUAGES,
  type Language,
} from '@cost-share/shared';

type Props = Readonly<{
  current: Language;
  label: string;
  className?: string;
}>;

export default function LanguagePicker({ current, label, className }: Props) {
  return (
    <form action="/api/locale" method="POST" className={className}>
      <label className="sr-only" htmlFor="locale-select">
        {label}
      </label>
      <select
        id="locale-select"
        name="locale"
        defaultValue={current}
        className="text-sm text-gray-600 bg-transparent border border-gray-200 rounded-md px-2 py-1 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-200"
        onChange={(e) => {
          e.currentTarget.form?.requestSubmit();
        }}
      >
        {SUPPORTED_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_NATIVE_LABELS[code]}
          </option>
        ))}
      </select>
    </form>
  );
}
