import type { GroupRollup } from '@cost-share/shared';

export function rollupOf(
    primary: { currency: string; net: number },
    others: { currency: string; net: number }[] = [],
): GroupRollup {
    return { groupId: 'g1', primary, others };
}
