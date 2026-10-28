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

Deno.test('dispatchRecurringExpenses drains until batch under limit', async () => {
    let calls = 0;
    const result = await dispatchRecurringExpenses(
        {
            async generateDue() {
                calls += 1;
                return { created: calls < 3 ? 200 : 50 };
            },
        },
        200,
        5,
    );
    assertEquals(result, { ok: true, created: 450, skipped: false });
    assertEquals(calls, 3);
});
