import { Injectable } from '@nestjs/common';
import { Settlement, CreateSettlementDto } from '@cost-share/shared';
import { SupabaseService } from '../database/supabase.service';
import { settlementFromRow } from '../database/mappers';
import { CalculationsService } from './calculations.service';

@Injectable()
export class SettlementsService {
    constructor(
        private readonly supabase: SupabaseService,
        private readonly calculationsService: CalculationsService,
    ) {}

    async findAll(): Promise<Settlement[]> {
        const { data, error } = await this.supabase.client
            .from('settlements')
            .select('*')
            .order('settlement_date', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(settlementFromRow);
    }

    async findById(id: string): Promise<Settlement | undefined> {
        const { data, error } = await this.supabase.client
            .from('settlements')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return data ? settlementFromRow(data) : undefined;
    }

    async findByGroup(groupId: string): Promise<Settlement[]> {
        const { data, error } = await this.supabase.client
            .from('settlements')
            .select('*')
            .eq('group_id', groupId)
            .order('settlement_date', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(settlementFromRow);
    }

    async findByUser(userId: string): Promise<Settlement[]> {
        const { data, error } = await this.supabase.client
            .from('settlements')
            .select('*')
            .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
            .order('settlement_date', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(settlementFromRow);
    }

    async create(
        dto: CreateSettlementDto,
        createdBy: string,
    ): Promise<Settlement | { error: string }> {
        const validation = await this.calculationsService.validateSettlement(
            dto.groupId,
            dto.fromUserId,
            dto.toUserId,
            dto.amount,
        );
        if (!validation.valid) return { error: validation.message || 'Invalid settlement' };

        const settlementDate = (dto.settlementDate ?? new Date()).toISOString().slice(0, 10);

        const { data, error } = await this.supabase.client
            .from('settlements')
            .insert({
                group_id: dto.groupId,
                from_user_id: dto.fromUserId,
                to_user_id: dto.toUserId,
                amount: dto.amount,
                currency: dto.currency,
                settlement_date: settlementDate,
                payment_method: dto.paymentMethod,
                created_by: createdBy,
            })
            .select()
            .single();
        if (error) throw error;
        return settlementFromRow(data);
    }

    async getSettlementHistory(
        groupId: string,
        userId1: string,
        userId2: string,
    ): Promise<Settlement[]> {
        const { data, error } = await this.supabase.client
            .from('settlements')
            .select('*')
            .eq('group_id', groupId)
            .or(
                `and(from_user_id.eq.${userId1},to_user_id.eq.${userId2}),and(from_user_id.eq.${userId2},to_user_id.eq.${userId1})`,
            )
            .order('settlement_date', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(settlementFromRow);
    }
}
