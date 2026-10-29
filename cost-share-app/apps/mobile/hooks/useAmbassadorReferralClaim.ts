import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { claimPendingAmbassadorReferral } from '../services/ambassador.service';

/** Claim stored ?ref= ambassador code once per session after auth. */
export function useAmbassadorReferralClaim(): void {
    const session = useAppStore((s) => s.session);
    const claimed = useRef(false);

    useEffect(() => {
        if (!session || claimed.current) return;
        claimed.current = true;
        void claimPendingAmbassadorReferral();
    }, [session]);
}
