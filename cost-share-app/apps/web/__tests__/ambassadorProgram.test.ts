import assert from 'node:assert/strict';
import test from 'node:test';
import { getTranslations } from '@/lib/i18n';
import { ambassadorProgramPath } from '@/lib/marketingSeo';
import { buildAmbassadorProgramPageMetadata } from '@/lib/ambassadorProgramMetadata';

test('ambassador program path is localized', () => {
    assert.equal(ambassadorProgramPath('he'), '/he/ambassadors');
});

test('ambassador program metadata includes canonical for en', async () => {
    const meta = buildAmbassadorProgramPageMetadata('en');
    assert.match(String(meta.alternates?.canonical), /\/en\/ambassadors$/);
});

test('all web locales define ambassadorProgram copy', () => {
    for (const locale of ['en', 'he', 'ru', 'ar', 'fr', 'es', 'de'] as const) {
        const t = getTranslations(locale);
        assert.ok(t.ambassadorProgram.form.submit);
        assert.equal(t.ambassadorProgram.benefits.items.length, 3);
    }
});
