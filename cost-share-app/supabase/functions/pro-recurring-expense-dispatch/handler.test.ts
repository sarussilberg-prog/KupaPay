import { assertEquals } from 'jsr:@std/assert';
import { dispatchRecurringExpenses } from './handler.ts';

Deno.test('dispatchRecurringExpenses returns created count', async () => {
    const result = await dispatchRecurringExpenses({
        async generateDue() {
            return { created: 3 };
        },
    });
    assertEquals(result, { ok: true, created: 3, skipped: false });
});

Deno.test('dispatchRecurringExpenses reports lock skip', async () => {
    const result = await dispatchRecurringExpenses({
        async generateDue() {
            return { skipped: true };
        },
    });
    assertEquals(result.skipped, true);
});
