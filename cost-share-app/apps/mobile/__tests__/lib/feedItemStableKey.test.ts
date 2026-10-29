import { feedItemStableKey } from '../../lib/feedItemStableKey';
import type { FeedItem } from '@cost-share/shared';

describe('feedItemStableKey', () => {
    it('prefixes expense ids', () => {
        const item = {
            kind: 'expense',
            expense: { id: 'e-42' },
        } as FeedItem;
        expect(feedItemStableKey(item)).toBe('e:e-42');
    });

    it('prefixes message ids', () => {
        const item = {
            kind: 'message',
            message: { id: 'm1' },
        } as FeedItem;
        expect(feedItemStableKey(item)).toBe('m:m1');
    });
});
