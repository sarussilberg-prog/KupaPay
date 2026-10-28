/**
 * Admin Service — admin-only RPCs (gated by is_app_admin() on the DB).
 */
import { supabase } from '../lib/supabase';
import {
    setMyAdminProViewMode,
    type AdminProViewMode,
    type MyProStatus,
} from './proEntitlements.service';

export type { AdminProViewMode };

export async function setAdminProViewMode(
    mode: AdminProViewMode,
    durationHours = 24,
): Promise<MyProStatus> {
    return setMyAdminProViewMode(mode, durationHours);
}

export interface DeletedAccount {
    userId: string;
    email: string;
    deletedAt: Date;
    reason: string;
    openBalanceSnapshot: unknown;
    notes: string | null;
}

export interface RestoreResult {
    ok: boolean;
    error?: string; // i18n key
}

type Row = {
    user_id: string;
    email: string;
    deleted_at: string;
    reason: string;
    open_balance_snapshot: unknown;
    notes: string | null;
};

export async function listDeletedAccounts(): Promise<DeletedAccount[]> {
    const { data, error } = await supabase.rpc('admin_list_deleted_accounts');
    if (error || !data) {
        if (error) console.warn('listDeletedAccounts: RPC failed', error);
        return [];
    }
    return (data as Row[]).map((r) => ({
        userId: r.user_id,
        email: r.email,
        deletedAt: new Date(r.deleted_at),
        reason: r.reason,
        openBalanceSnapshot: r.open_balance_snapshot,
        notes: r.notes,
    }));
}

export async function restoreDeletedAccount(userId: string): Promise<RestoreResult> {
    const { error } = await supabase.rpc('admin_restore_deleted_account', { p_user_id: userId });
    if (!error) return { ok: true };

    console.warn('restoreDeletedAccount: RPC failed', error);
    if (error.message === 'not_authorized') {
        return { ok: false, error: 'admin.errors.notAuthorized' };
    }
    return { ok: false, error: 'admin.deletedUsers.restoreError' };
}

export async function submitSupportMessage(params: { name: string; email: string; message: string }): Promise<boolean> {
    const { error } = await supabase.from('support_messages').insert(params);
    if (error) {
        console.warn('submitSupportMessage: insert failed', error);
        return false;
    }
    return true;
}

export interface SupportMessage {
    id: string;
    name: string;
    email: string;
    message: string;
    status: 'open' | 'closed';
    createdAt: Date;
}

type SupportMessageRow = {
    id: string;
    name: string;
    email: string;
    message: string;
    status: 'open' | 'closed';
    created_at: string;
};

export async function listSupportMessages(): Promise<SupportMessage[]> {
    const { data, error } = await supabase.rpc('admin_list_support_messages');
    if (error || !data) {
        if (error) console.warn('listSupportMessages: RPC failed', error);
        return [];
    }
    return (data as SupportMessageRow[]).map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        message: r.message,
        status: r.status,
        createdAt: new Date(r.created_at),
    }));
}

export async function updateSupportMessageStatus(id: string, status: 'open' | 'closed'): Promise<boolean> {
    const { error } = await supabase.rpc('admin_update_support_message_status', { p_id: id, p_status: status });
    if (error) {
        console.warn('updateSupportMessageStatus: RPC failed', error);
        return false;
    }
    return true;
}

export interface MonetizationFunnel {
    ad_gate_shown: number;
    ad_gate_watch_tapped: number;
    ad_gate_watch_completed: number;
    ad_gate_pro_tapped: number;
    remind_sent: number;
}

export interface MonetizationMetrics {
    funnel: MonetizationFunnel;
    by_feature: Record<string, MonetizationFunnel>;
    by_platform: Record<string, number>;
    daily: Array<{ date: string; ad_gate_shown: number; ad_gate_watch_completed: number; remind_sent: number }>;
}

export type AdminMonetizationMetricsFailure =
    | 'not_admin'
    | 'analytics_unavailable'
    | 'unknown';

export class AdminMonetizationMetricsError extends Error {
    readonly code: AdminMonetizationMetricsFailure;

    constructor(code: AdminMonetizationMetricsFailure, message?: string) {
        super(message ?? code);
        this.name = 'AdminMonetizationMetricsError';
        this.code = code;
    }
}

function classifyMonetizationRpcError(error: { message?: string; code?: string; details?: string }): AdminMonetizationMetricsFailure {
    const msg = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
    if (msg.includes('not_admin')) return 'not_admin';
    if (
        error.code === 'PGRST202' ||
        error.code === '42883' ||
        msg.includes('could not find the function') ||
        msg.includes('function') && msg.includes('does not exist')
    ) {
        return 'analytics_unavailable';
    }
    if (
        error.code === '42501' ||
        msg.includes('permission denied') ||
        msg.includes('insufficient_privilege')
    ) {
        return 'analytics_unavailable';
    }
    return 'unknown';
}

async function fetchAdminAnalyticsRpc<T>(
    rpcName: string,
    parse: (data: unknown) => T,
    ErrorClass: typeof AdminMonetizationMetricsError,
): Promise<T> {
    const { data, error } = await supabase.rpc(rpcName);
    if (error) {
        console.warn(`${rpcName}: RPC failed`, error);
        throw new ErrorClass(classifyMonetizationRpcError(error), error.message);
    }
    if (!data) {
        throw new ErrorClass('unknown', 'empty_response');
    }
    return parse(data);
}

export async function fetchAdminMonetizationMetrics(): Promise<MonetizationMetrics> {
    return fetchAdminAnalyticsRpc(
        'get_monetization_metrics',
        (data) => data as MonetizationMetrics,
        AdminMonetizationMetricsError,
    );
}

import {
    parseGrowthMetricsRpc,
    type AdminGrowthMetrics,
    type AdminPlatformMetrics,
} from '@cost-share/shared';

type MetricsRow = {
    version: number;
    generatedAt: string;
    users: AdminPlatformMetrics['users'];
    groups: AdminPlatformMetrics['groups'];
};

export interface AdminPromoCodeRow {
    id: string;
    code: string;
    durationDays: number;
    maxUses: number | null;
    useCount: number;
    expiresAt: Date | null;
    active: boolean;
    createdAt: Date;
}

type PromoCodeRpcRow = {
    id: string;
    code: string;
    duration_days: number;
    max_uses: number | null;
    use_count: number;
    expires_at: string | null;
    active: boolean;
    created_at: string;
};

export async function listAdminPromoCodes(): Promise<AdminPromoCodeRow[]> {
    const { data, error } = await supabase.rpc('admin_list_promo_codes');
    if (error || !data) {
        if (error) console.warn('listAdminPromoCodes: RPC failed', error);
        return [];
    }
    return (data as PromoCodeRpcRow[]).map(r => ({
        id: r.id,
        code: r.code,
        durationDays: r.duration_days,
        maxUses: r.max_uses,
        useCount: Number(r.use_count ?? 0),
        expiresAt: r.expires_at ? new Date(r.expires_at) : null,
        active: r.active,
        createdAt: new Date(r.created_at),
    }));
}

export async function createAdminPromoCode(params: {
    code: string;
    durationDays: number;
    maxUses?: number | null;
    expiresAt?: Date | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: 'not_authorized' | 'invalid' | 'unknown' }> {
    const { data, error } = await supabase.rpc('admin_create_promo_code', {
        p_code: params.code.trim(),
        p_duration_days: params.durationDays,
        p_max_uses: params.maxUses ?? null,
        p_expires_at: params.expiresAt?.toISOString() ?? null,
    });
    if (error) {
        console.warn('createAdminPromoCode: RPC failed', error);
        if (error.message?.includes('not_authorized')) return { ok: false, error: 'not_authorized' };
        if (
            error.message?.includes('promo_code_invalid') ||
            error.message?.includes('promo_duration_invalid')
        ) {
            return { ok: false, error: 'invalid' };
        }
        return { ok: false, error: 'unknown' };
    }
    return { ok: true, id: String(data) };
}

export async function setAdminPromoCodeActive(
    promoCodeId: string,
    active: boolean,
): Promise<boolean> {
    const { error } = await supabase.rpc('admin_set_promo_code_active', {
        p_promo_code_id: promoCodeId,
        p_active: active,
    });
    if (error) {
        console.warn('setAdminPromoCodeActive: RPC failed', error);
        return false;
    }
    return true;
}

export class AdminGrowthMetricsError extends AdminMonetizationMetricsError {
    constructor(code: AdminMonetizationMetricsFailure, message?: string) {
        super(code, message);
        this.name = 'AdminGrowthMetricsError';
    }
}

export async function fetchAdminGrowthMetrics(): Promise<AdminGrowthMetrics> {
    return fetchAdminAnalyticsRpc(
        'get_growth_metrics',
        (data) => parseGrowthMetricsRpc(data as Record<string, unknown>),
        AdminGrowthMetricsError,
    );
}

export async function fetchAdminPlatformMetrics(): Promise<AdminPlatformMetrics | null> {
    const { data, error } = await supabase.rpc('admin_get_platform_metrics');
    if (error || !data) {
        if (error) console.warn('fetchAdminPlatformMetrics: RPC failed', error);
        return null;
    }
    const r = data as MetricsRow;
    return {
        version: r.version,
        generatedAt: r.generatedAt,
        users: {
            registered: Number(r.users?.registered ?? 0),
            deleted: Number(r.users?.deleted ?? 0),
        },
        groups: {
            active: Number(r.groups?.active ?? 0),
            archived: Number(r.groups?.archived ?? 0),
            deleted: Number(r.groups?.deleted ?? 0),
            manualArchiveMemberships: Number(r.groups?.manualArchiveMemberships ?? 0),
        },
    };
}
