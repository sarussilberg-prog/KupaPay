import {
    consumeSplitCalculatorPostLoginReturn,
    SPLIT_CALCULATOR_POST_LOGIN_RETURN_KEY,
} from '../../lib/splitCalculatorPostLoginReturn';

describe('splitCalculatorPostLoginReturn', () => {
    const store = new Map<string, string>();

    beforeEach(() => {
        store.clear();
        Object.defineProperty(globalThis, 'sessionStorage', {
            configurable: true,
            value: {
                getItem: (key: string) => store.get(key) ?? null,
                setItem: (key: string, value: string) => {
                    store.set(key, value);
                },
                removeItem: (key: string) => {
                    store.delete(key);
                },
                clear: () => store.clear(),
            },
        });
    });

    it('consumes and clears the stored return URL', () => {
        store.set(SPLIT_CALCULATOR_POST_LOGIN_RETURN_KEY, 'https://kupa-pay.com/en/split-calculator');
        expect(consumeSplitCalculatorPostLoginReturn()).toBe(
            'https://kupa-pay.com/en/split-calculator',
        );
        expect(store.has(SPLIT_CALCULATOR_POST_LOGIN_RETURN_KEY)).toBe(false);
    });
});
