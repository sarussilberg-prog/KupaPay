import { Text } from '../AppText';
import React from 'react';
import { View } from 'react-native';
import { AppIcon, AppIconName } from '../AppIcon';
import { colors } from '../../theme';
import { IconLabel } from '../ui/IconLabel';
import { ListRow } from '../ui/ListRow';
import { useRtlLayout } from '../../hooks/useRtlLayout';
import {
    settingsRowValueClusterStyle,
    settingsRowValueTextStyle,
    settingsRowValueTrailingSpacerStyle,
} from './settingsRowLayout';

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
    const isValue = props.variant === 'value';

    return (
        <ListRow onPress={props.onPress} testID={testID} disabled={disabled}>
            {isValue ? (
                <>
                    <View style={settingsRowValueClusterStyle(isRtl)} testID={testID ? `${testID}-value-cluster` : undefined}>
                        <IconLabel
                            iconName={iconName}
                            iconColor={iconColor}
                            label={label}
                            labelClassName={`text-base ${textColor}`}
                            flex={false}
                        />
                        <Text
                            className="text-sm text-gray-500"
                            style={settingsRowValueTextStyle()}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            testID={testID ? `${testID}-value` : undefined}
                        >
                            {props.valueText}
                        </Text>
                    </View>
                    <View style={settingsRowValueTrailingSpacerStyle()} />
                </>
            ) : (
                <IconLabel
                    iconName={iconName}
                    iconColor={iconColor}
                    label={label}
                    labelClassName={`text-base ${textColor}`}
                />
            )}
            <AppIcon
                name={isRtl ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={colors.gray400}
            />
        </ListRow>
    );
}
