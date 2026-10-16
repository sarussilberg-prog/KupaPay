import fs from 'fs';
import path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const STORE_PLAY = path.join(REPO_ROOT, 'store/play');
const LOCALES = ['en', 'he', 'ru', 'ar', 'fr', 'es', 'de'] as const;

describe('Play store listing assets', () => {
    it('includes localized title, short and full descriptions', () => {
        for (const locale of LOCALES) {
            const base = path.join(STORE_PLAY, locale);
            for (const file of ['title.txt', 'short_description.txt', 'full_description.txt'] as const) {
                const p = path.join(base, file);
                expect(fs.existsSync(p)).toBe(true);
                expect(fs.readFileSync(p, 'utf8').trim().length).toBeGreaterThan(0);
            }
        }
    });

    it('includes feature graphic and phone screenshots', () => {
        expect(fs.existsSync(path.join(STORE_PLAY, 'graphics/feature-graphic-1024x500.png'))).toBe(true);
        const phoneDir = path.join(STORE_PLAY, 'graphics/phone');
        const shots = fs.readdirSync(phoneDir).filter(f => f.endsWith('.png'));
        expect(shots.length).toBeGreaterThanOrEqual(2);
    });

    it('documents data safety and content rating answers', () => {
        expect(fs.existsSync(path.join(STORE_PLAY, 'DATA_SAFETY_ANSWERS.md'))).toBe(true);
        expect(fs.existsSync(path.join(STORE_PLAY, 'CONTENT_RATING_ANSWERS.md'))).toBe(true);
        expect(fs.existsSync(path.join(STORE_PLAY, 'SUBSCRIPTION_OFFERS.md'))).toBe(true);
        expect(fs.existsSync(path.join(REPO_ROOT, 'docs/PLAY_SETUP.md'))).toBe(true);
    });
});
