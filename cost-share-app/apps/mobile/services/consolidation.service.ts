import { supabase } from '../lib/supabase';
import { showSuccessToast } from '../lib/appToast';
import { handleError } from '../lib/handleError';

export interface ConsolidationSettlementInput {
    currency: string;
    amount: number;
    exchangeRate: number;
    fromUserId: string;
    toUserId: string;
}

export interface CreateConsolidationBatchParams {
    groupId: string;
    fromUserId: string;
    toUserId: string;
    paymentCurrency: string;
    paymentAmount: number;
    settlementDate: Date;
    settlements: ConsolidationSettlementInput[];
}

export async function createConsolidationBatch(
    params: CreateConsolidationBatchParams,
): Promise<string | null> {
    const settlementDate = params.settlementDate.toISOString().slice(0, 10);

    try {
        const { data, error } = await supabase.rpc('create_consolidation_batch', {
            p_group_id: params.groupId,
            p_from_user_id: params.fromUserId,
            p_to_user_id: params.toUserId,
            p_payment_currency: params.paymentCurrency,
            p_payment_amount: params.paymentAmount,
            p_settlement_date: settlementDate,
            p_settlements: params.settlements.map(s => ({
                currency: s.currency,
                amount: s.amount,
                exchange_rate: s.exchangeRate,
                from_user_id: s.fromUserId,
                to_user_id: s.toUserId,
            })),
        });
        if (error) throw error;
        showSuccessToast('consolidation.toastCreated');
        return data as string;
    } catch (error) {
        handleError(error, {
            toast: { titleKey: 'consolidation.recordError', messageKey: 'common.networkError' },
            tags: { service: 'consolidation', op: 'create' },
            extra: { groupId: params.groupId, currencyCount: params.settlements.length },
        });
        return null;
    }
}

export async function deleteConsolidationBatch(batchId: string): Promise<boolean> {
    try {
        const { error } = await supabase.rpc('delete_consolidation_batch', {
            p_batch_id: batchId,
        });
        if (error) throw error;
        showSuccessToast('consolidation.toastDeleted');
        return true;
    } catch (error) {
        handleError(error, {
            toast: { titleKey: 'consolidation.deleteError', messageKey: 'common.networkError' },
            tags: { service: 'consolidation', op: 'delete' },
            extra: { batchId },
        });
        return false;
    }
}
