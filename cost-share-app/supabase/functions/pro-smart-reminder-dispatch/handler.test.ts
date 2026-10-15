import { dispatchSmartPaymentReminders } from './handler.ts';

Deno.test('dispatchSmartPaymentReminders returns RPC counts', async () => {
    const result = await dispatchSmartPaymentReminders({
        async runDispatch() {
            return { sent: 2, skipped: 1 };
        },
    });
    if (result.sent !== 2 || result.skipped !== 1) {
        throw new Error(`unexpected ${JSON.stringify(result)}`);
    }
});
