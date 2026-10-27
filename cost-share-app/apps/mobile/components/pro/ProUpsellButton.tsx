import React from 'react';
import { ProUpgradeButton, type ProUpgradeButtonProps } from '../ProUpgradeButton';
import { useShowProUpsell } from '../../hooks/useShowProUpsell';

type Props = ProUpgradeButtonProps &
    Readonly<{
        groupId?: string | null;
    }>;

/** Standard upgrade CTA — hidden when the user already has Pro. */
export function ProUpsellButton({ groupId, ...buttonProps }: Props) {
    const showUpsell = useShowProUpsell(groupId);
    if (!showUpsell) return null;
    return <ProUpgradeButton {...buttonProps} />;
}
