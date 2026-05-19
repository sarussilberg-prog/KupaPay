import { Injectable } from '@nestjs/common';
import {
    Group,
    GroupMember,
    CreateGroupDto,
    UpdateGroupDto,
    AddGroupMemberDto,
} from '@cost-share/shared';
import { SupabaseService } from '../database/supabase.service';
import { groupFromRow, groupMemberFromRow } from '../database/mappers';

@Injectable()
export class GroupsService {
    constructor(private readonly supabase: SupabaseService) {}

    async findAll(): Promise<Group[]> {
        const { data, error } = await this.supabase.client
            .from('groups')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(groupFromRow);
    }

    async findAllForUser(userId: string): Promise<Group[]> {
        const { data: memberships, error: memberErr } = await this.supabase.client
            .from('group_members')
            .select('group_id')
            .eq('user_id', userId)
            .eq('is_active', true);
        if (memberErr) throw memberErr;

        const groupIds = (memberships ?? []).map((m) => m.group_id as string);
        if (groupIds.length === 0) return [];

        const { data, error } = await this.supabase.client
            .from('groups')
            .select('*')
            .in('id', groupIds)
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data ?? []).map(groupFromRow);
    }

    async findById(id: string): Promise<Group | undefined> {
        const { data, error } = await this.supabase.client
            .from('groups')
            .select('*')
            .eq('id', id)
            .eq('is_active', true)
            .maybeSingle();
        if (error) throw error;
        return data ? groupFromRow(data) : undefined;
    }

    async create(dto: CreateGroupDto, createdBy: string): Promise<Group> {
        const { data: groupRow, error: groupErr } = await this.supabase.client
            .from('groups')
            .insert({
                name: dto.name,
                description: dto.description,
                image_url: dto.imageUrl,
                group_type: dto.groupType ?? 'general',
                default_currency: dto.defaultCurrency ?? 'USD',
                created_by: createdBy,
            })
            .select()
            .single();
        if (groupErr) throw groupErr;

        const memberIds = new Set<string>([createdBy, ...dto.memberIds]);
        const rows = Array.from(memberIds).map(userId => ({
            group_id: groupRow.id,
            user_id: userId,
        }));
        const { error: membersErr } = await this.supabase.client
            .from('group_members')
            .insert(rows);
        if (membersErr) throw membersErr;

        return groupFromRow(groupRow);
    }

    async update(id: string, dto: UpdateGroupDto): Promise<Group | undefined> {
        const patch: Record<string, any> = {};
        if (dto.name !== undefined) patch.name = dto.name;
        if (dto.description !== undefined) patch.description = dto.description;
        if (dto.imageUrl !== undefined) patch.image_url = dto.imageUrl;
        if (dto.groupType !== undefined) patch.group_type = dto.groupType;
        if (dto.defaultCurrency !== undefined) patch.default_currency = dto.defaultCurrency;

        const { data, error } = await this.supabase.client
            .from('groups')
            .update(patch)
            .eq('id', id)
            .eq('is_active', true)
            .select()
            .maybeSingle();
        if (error) throw error;
        return data ? groupFromRow(data) : undefined;
    }

    async delete(id: string): Promise<boolean> {
        const { data, error } = await this.supabase.client
            .from('groups')
            .update({ is_active: false })
            .eq('id', id)
            .select('id')
            .maybeSingle();
        if (error) throw error;
        return data !== null;
    }

    async findByUserId(userId: string): Promise<Group[]> {
        const { data, error } = await this.supabase.client
            .from('group_members')
            .select('groups(*)')
            .eq('user_id', userId)
            .eq('is_active', true);
        if (error) throw error;
        return (data ?? [])
            .map((row: any) => row.groups)
            .filter((g: any) => g && g.is_active)
            .map(groupFromRow);
    }

    async getMembers(groupId: string): Promise<GroupMember[]> {
        const { data, error } = await this.supabase.client
            .from('group_members')
            .select('*')
            .eq('group_id', groupId)
            .eq('is_active', true);
        if (error) throw error;
        return (data ?? []).map(groupMemberFromRow);
    }

    async addMember(dto: AddGroupMemberDto): Promise<GroupMember> {
        const { data, error } = await this.supabase.client
            .from('group_members')
            .insert({ group_id: dto.groupId, user_id: dto.userId })
            .select()
            .single();
        if (error) throw error;
        return groupMemberFromRow(data);
    }

    async removeMember(groupId: string, userId: string): Promise<boolean> {
        const { data, error } = await this.supabase.client
            .from('group_members')
            .update({ is_active: false, left_at: new Date().toISOString() })
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .eq('is_active', true)
            .select('id')
            .maybeSingle();
        if (error) throw error;
        return data !== null;
    }
}
