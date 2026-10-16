import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { supabase } from '../lib/supabase';
import { getPermissionStatus } from '../lib/pushNotifications';
import type { ActivityEventKind } from '@cost-share/shared';

/** When web push is unavailable, surface new activity as in-app toasts (#402). */
export function useWebInAppPushFallback(userId: string | undefined): void {
    const { t } = useTranslation();
    const lastId = useRef<string | null>(null);

    useEffect(() => {
        if (Platform.OS !== 'web' || !userId) return;

        let channel: ReturnType<typeof supabase.channel> | undefined;

        void (async () => {
            const status = await getPermissionStatus();
            if (status === 'granted') return;

            channel = supabase
                .channel(`web-push-fallback:${userId}`)
                .on(
                    'postgres_changes' as never,
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'activity_events',
                        filter: `user_id=eq.${userId}`,
                    },
                    (payload: { new: { id: string; kind: ActivityEventKind; actor_user_id?: string | null } }) => {
                        const row = payload.new;
                        if (!row?.id || row.id === lastId.current) return;
                        if (row.actor_user_id === userId) return;
                        lastId.current = row.id;
                        const title = t(`notifications.webFallback.${row.kind}`, {
                            defaultValue: t('notifications.webFallback.default'),
                        });
                        Toast.show({ type: 'info', text1: title, visibilityTime: 4000 });
                    },
                )
                .subscribe();
        })();

        return () => {
            if (channel) {
                void channel.unsubscribe();
                void supabase.removeChannel(channel);
            }
        };
    }, [userId, t]);
}
