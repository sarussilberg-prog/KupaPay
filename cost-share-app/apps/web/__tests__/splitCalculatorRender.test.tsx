import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SplitCalculatorTool from '../app/_components/SplitCalculatorTool';
import { getTranslations } from '../lib/i18n';

test('SplitCalculatorTool renders main headings and form controls', () => {
    const t = getTranslations('en');
    const html = renderToStaticMarkup(
        <SplitCalculatorTool locale="en" t={t} />,
    );
    assert.match(html, /Expense split calculator/);
    assert.match(html, /id="participants-heading"/);
    assert.match(html, /id="expenses-heading"/);
    assert.match(html, /id="results-heading"/);
    assert.match(html, /type="number"/);
    assert.match(html, /Checking sign-in|Save as group|Sign in to save/);
    assert.match(html, /id="import-group-name"/);
});
