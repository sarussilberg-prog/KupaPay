import fs from 'fs';
import path from 'path';

const MOBILE_DIR = path.resolve(__dirname, '../..');

const HOT_SCREENS = [
    'screens/groups/GroupsListScreen.tsx',
    'screens/groups/GroupDetailScreen.tsx',
    'screens/expenses/ExpenseListScreen.tsx',
    'screens/activity/ActivityFeedScreen.tsx',
];

describe('hot list FlashList guard', () => {
    it('hot screens use HotVirtualizedList instead of FlatList', () => {
        for (const rel of HOT_SCREENS) {
            const src = fs.readFileSync(path.join(MOBILE_DIR, rel), 'utf8');
            expect(src).toMatch(/HotVirtualizedList/);
            expect(src).not.toMatch(/\bFlatList\b/);
        }
    });
});
