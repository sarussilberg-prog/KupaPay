import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import UseCaseFaqStructuredData from '../app/_components/UseCaseFaqStructuredData';
import { getTranslations } from '../lib/i18n';
import { buildUseCasePageMetadata } from '../lib/useCaseMetadata';

test('UseCaseFaqStructuredData emits FAQPage JSON-LD', () => {
    const t = getTranslations('en');
    const html = renderToStaticMarkup(
        <UseCaseFaqStructuredData items={t.useCases.trip.faq.items} />,
    );
    assert.match(html, /FAQPage/);
    assert.match(html, /Can we use different currencies on one trip/);
});

test('use case metadata includes canonical and hreflang for trip', () => {
    const meta = buildUseCasePageMetadata('en', 'trip');
    assert.equal(meta.alternates?.canonical, 'https://kupa-pay.com/en/trip-expenses');
    assert.ok(meta.alternates?.languages?.he?.includes('/he/trip-expenses'));
});

test('Hebrew trip hero copy is localized', () => {
    const en = getTranslations('en').useCases.trip.hero.headline;
    const he = getTranslations('he').useCases.trip.hero.headline;
    assert.notEqual(en, he);
    assert.match(he, /טיול/);
});
