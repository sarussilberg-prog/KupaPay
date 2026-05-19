import { Injectable } from '@nestjs/common';
import { User, UpdateProfileDto } from '@cost-share/shared';
import { SupabaseService } from '../database/supabase.service';
import { profileFromRow } from '../database/mappers';

@Injectable()
export class UsersService {
    constructor(private readonly supabase: SupabaseService) {}

    async findAll(): Promise<User[]> {
        const { data, error } = await this.supabase.client
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: true });
        if (error) throw error;
        return (data ?? []).map(profileFromRow);
    }

    async findById(id: string): Promise<User | undefined> {
        const { data, error } = await this.supabase.client
            .from('profiles')
            .select('*')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        return data ? profileFromRow(data) : undefined;
    }

    async update(id: string, updates: UpdateProfileDto): Promise<User | undefined> {
        const patch: Record<string, any> = {};
        if (updates.name !== undefined) patch.name = updates.name;
        if (updates.email !== undefined) patch.email = updates.email;
        if (updates.phone !== undefined) patch.phone = updates.phone;
        if (updates.avatarUrl !== undefined) patch.avatar_url = updates.avatarUrl;
        if (updates.defaultCurrency !== undefined) patch.default_currency = updates.defaultCurrency;
        if (updates.language !== undefined) patch.language = updates.language;

        const { data, error } = await this.supabase.client
            .from('profiles')
            .update(patch)
            .eq('id', id)
            .select()
            .maybeSingle();
        if (error) throw error;
        return data ? profileFromRow(data) : undefined;
    }

    async searchByName(query: string): Promise<User[]> {
        const { data, error } = await this.supabase.client
            .from('profiles')
            .select('*')
            .ilike('name', `%${query}%`);
        if (error) throw error;
        return (data ?? []).map(profileFromRow);
    }
}
