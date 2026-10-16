import { Text } from '../AppText';
import React from 'react';
import { AppIcon, AppIconName } from '../AppIcon';
import { colors } from '../../theme';
import { IconLabel } from '../ui/IconLabel';
import { ListRow } from '../ui/ListRow';
import { useRtlLayout } from '../../hooks/useRtlLayout';

type Variant = 'chevron' | 'value' | 'danger';

interface BaseProps {
    iconName: AppIconName;
    label: string;
    testID?: string;
    disabled?: boolean;
}

interface ChevronProps extends BaseProps { variant: 'chevron' | 'danger'; onPress: () => void; }
interface ValueProps extends BaseProps { variant: 'value'; valueText: string; onPress: () => void; }

type Props = ChevronProps | ValueProps;

export function SettingsRow(props: Props) {
    const { iconName, label, testID, disabled } = props;
    const isRtl = useRtlLayout();
    const isDanger = props.variant === 'danger';
    const iconColor = isDanger ? colors.error : colors.gray500;
    const textColor = isDanger ? 'text-red-600' : 'text-gray-900';

    return (
        <ListRow onPress={props.onPress} testID={testID} disabled={disabled}>
            <IconLabel
                iconName={iconName}
                iconColor={iconColor}
                label={label}
                labelClassName={`text-base ${textColor}`}
            />
            {props.variant === 'value' ? (
                <Text className="text-sm text-gray-500 shrink-0">{props.valueText}</Text>
            ) : null}
            <AppIcon
                name={isRtl ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={colors.gray400}
            />
        </ListRow>
    );
}
