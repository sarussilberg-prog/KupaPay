import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

@Injectable()
export class SupabaseService implements OnModuleInit {
    private readonly logger = new Logger(SupabaseService.name);
    private _client!: SupabaseClient;

    constructor(private readonly config: ConfigService) {}

    onModuleInit() {
        const url = this.config.get<string>('SUPABASE_URL');
        const key = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');

        if (!url || !key) {
            throw new Error(
                'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env and fill in your Supabase credentials.',
            );
        }

        this._client = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
            // ws types don't match WebSocketLikeConstructor until @supabase/realtime-js types catch up
            realtime: { transport: ws as never },
        });

        this.logger.log(`Supabase client initialized for ${url}`);
    }

    get client(): SupabaseClient {
        return this._client;
    }
}
