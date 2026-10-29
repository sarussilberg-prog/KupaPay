'use client';

import { AMBASSADOR_REF_COOKIE } from '@cost-share/shared';
import { useEffect, useRef } from 'react';
import { getBrowserSupabaseClient } from '@/utils/supabase/browser';

function readAmbassadorRefCookie(): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${AMBASSADOR_REF_COOKIE}=([^;]*)`));
    if (!match) return null;
    try {
        return decodeURIComponent(match[1]);
    } catch {
        return match[1];
    }
}

function clearAmbassadorRefCookie(): void {
    document.cookie = `${AMBASSADOR_REF_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/** After sign-in, attribute ambassador ?ref= captured in cookie (marketing pages). */
export default function AmbassadorRefAttribution() {
    const attempted = useRef(false);

    useEffect(() => {
        const supabase = getBrowserSupabaseClient();
        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session || attempted.current) return;
            const code = readAmbassadorRefCookie();
            if (!code) return;
            attempted.current = true;
            void (async () => {
                await supabase.rpc('attribute_ambassador_referral', { p_code: code });
                clearAmbassadorRefCookie();
            })();
        });
        return () => sub.subscription.unsubscribe();
    }, []);

    return null;
}
