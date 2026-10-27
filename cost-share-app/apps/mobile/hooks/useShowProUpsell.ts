import { KUPAPAY_PRO_ENABLED } from '../lib/featureFlags';
import { useProStatus } from './useProStatus';

/** True when Pro upsell CTAs should render (feature on and user lacks Pro). */
export function useShowProUpsell(groupId?: string | null): boolean {
    const { hasPro } = useProStatus(groupId);
    return KUPAPAY_PRO_ENABLED && !hasPro;
}
