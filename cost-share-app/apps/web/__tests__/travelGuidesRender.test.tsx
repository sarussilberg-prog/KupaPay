import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import TravelGuidesIndexLanding from '../app/_components/TravelGuidesIndexLanding';
import TravelGuideArticleLanding from '../app/_components/TravelGuideArticleLanding';
import { getTranslations } from '../lib/i18n';

test('TravelGuidesIndexLanding renders guide links', () => {
    const t = getTranslations('en');
    const html = renderToStaticMarkup(<TravelGuidesIndexLanding locale="en" t={t} />);
    assert.match(html, /Travel money guides for group trips/);
    assert.match(html, /href="\/en\/guides\/japan-travel-money-tips"/);
    assert.match(html, /href="\/en\/split-calculator"/);
});

test('TravelGuideArticleLanding renders tips and tool links', () => {
    const t = getTranslations('en');
    const html = renderToStaticMarkup(
        <TravelGuideArticleLanding locale="en" guideId="groupTripSplit" t={t} />,
    );
    assert.match(html, /Splitting costs on a group trip/);
    assert.match(html, /href="\/en\/guides"/);
    assert.match(html, /href="\/en\/trip-expenses"/);
});

test('TravelGuidesIndexLanding renders RTL locale without fixed width traps', () => {
    const t = getTranslations('ar');
    const html = renderToStaticMarkup(<TravelGuidesIndexLanding locale="ar" t={t} />);
    assert.doesNotMatch(html, /width:\s*\d+px/i);
    assert.match(html, /max-w-/);
});
