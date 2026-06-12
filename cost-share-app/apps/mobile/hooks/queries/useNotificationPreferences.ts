import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchNotificationPreferences, saveNotificationPreferences } from '../../services/notificationPreferences.service';
import { useAppStore } from '../../store';
import type { NotificationPreferences } from '@cost-share/shared';

const KEY = ['notificationPreferences'] as const;

export function useNotificationPreferences() {
    const userId = useAppStore((s) => s.currentUser?.id);
    return useQuery({
        queryKey: KEY,
        queryFn: () => fetchNotificationPreferences(userId as string),
        enabled: Boolean(userId),
        staleTime: 60_000,
    });
}

export function useSaveNotificationPreferences() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (prefs: NotificationPreferences) => saveNotificationPreferences(prefs),
        onMutate: async (prefs) => {
            await qc.cancelQueries({ queryKey: KEY });
            const previous = qc.getQueryData<NotificationPreferences>(KEY);
            qc.setQueryData(KEY, prefs); // optimistic
            return { previous };
        },
        onError: (_e, _prefs, ctx) => {
            if (ctx?.previous) qc.setQueryData(KEY, ctx.previous); // rollback
        },
        onSettled: () => { void qc.invalidateQueries({ queryKey: KEY }); },
    });
}
