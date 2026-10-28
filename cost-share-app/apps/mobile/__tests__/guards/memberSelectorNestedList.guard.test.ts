import fs from 'fs';
import path from 'path';

const MEMBER_SELECTOR = path.resolve(
    __dirname,
    '../../components/MemberSelector.tsx',
);

describe('MemberSelector nested list guard', () => {
    it('does not use FlatList (safe inside parent ScrollView in AddMembersSheet)', () => {
        const src = fs.readFileSync(MEMBER_SELECTOR, 'utf8');
        expect(src).not.toMatch(/\bFlatList\b/);
    });
});
