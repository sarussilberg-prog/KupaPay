/**
 * Standard Pro upsell CTA — centered label in LTR and RTL. Do not duplicate with raw TouchableOpacity.
 */

import React from 'react';
import { Button } from './Button';

export type ProUpgradeButtonProps = Readonly<{
    title: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
    testID?: string;
    fullWidth?: boolean;
    className?: string;
    /** Filled primary (default) or outline secondary upsell. */
    appearance?: 'filled' | 'outline';
}>;

export function ProUpgradeButton({
    title,
    onPress,
    disabled = false,
    loading = false,
    testID = 'pro-upgrade-button',
    fullWidth = true,
    className = '',
    appearance = 'filled',
}: ProUpgradeButtonProps) {
    return (
        <Button
            title={title}
            onPress={onPress}
            variant={appearance === 'outline' ? 'outline' : 'pro'}
            disabled={disabled}
            loading={loading}
            testID={testID}
            fullWidth={fullWidth}
            className={className}
        />
    );
}
