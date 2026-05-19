import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { User } from '@supabase/supabase-js';
import { SupabaseService } from '../database/supabase.service';
import { AuthUser } from './auth.types';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(private readonly supabase: SupabaseService) {}

    async verifyAccessToken(token: string): Promise<AuthUser> {
        const { data, error } = await this.supabase.client.auth.getUser(token);
        if (error || !data.user) {
            throw new UnauthorizedException('Invalid or expired token');
        }
        await this.ensureProfile(data.user);
        return {
            id: data.user.id,
            email: data.user.email ?? undefined,
        };
    }

    // Backfills profile rows for users that pre-date the schema's
    // on_auth_user_created trigger, and after dev DB resets.
    private async ensureProfile(user: User): Promise<void> {
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const name =
            (typeof meta.full_name === 'string' && meta.full_name) ||
            (typeof meta.name === 'string' && meta.name) ||
            user.email ||
            'User';
        const avatarUrl =
            typeof meta.avatar_url === 'string' ? meta.avatar_url : null;

        const { error } = await this.supabase.client
            .from('profiles')
            .upsert(
                { id: user.id, name, email: user.email ?? null, avatar_url: avatarUrl },
                { onConflict: 'id', ignoreDuplicates: true },
            );
        if (error) {
            this.logger.warn(`ensureProfile failed for ${user.id}: ${error.message}`);
        }
    }
}
