import React from 'react';

type FaqItem = Readonly<{ question: string; answer: string }>;

type Props = Readonly<{
    items: readonly FaqItem[];
}>;

export default function UseCaseFaqStructuredData({ items }: Props) {
    const payload = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
            },
        })),
    };

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
        />
    );
}
