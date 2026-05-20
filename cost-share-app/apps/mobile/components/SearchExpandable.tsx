/**
 * SearchExpandable — icon-only button that expands into a full-width search input.
 * Expanded state is controlled by the parent so it can hide sibling actions.
 */

import React, { useEffect, useRef } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from './AppText';
import { resolveAutoTextInputStyle, rtlTextClassName, useRtlLayout } from '../hooks/useRtlLayout';
import { AppIcon } from './AppIcon';
import { colors } from '../theme';

interface SearchExpandableProps {
    value: string;
    onChangeText: (v: string) => void;
    expanded: boolean;
    onExpandedChange: (expanded: boolean) => void;
    placeholder?: string;
    testID?: string;
}

export function SearchExpandable({
    value,
    onChangeText,
    expanded,
    onExpandedChange,
    placeholder,
    testID,
}: SearchExpandableProps) {
    const { t } = useTranslation();
    const isRtl = useRtlLayout();
    const inputRef = useRef<TextInput | null>(null);

    useEffect(() => {
        if (expanded) {
            const id = setTimeout(() => inputRef.current?.focus(), 30);
            return () => clearTimeout(id);
        }
    }, [expanded]);

    if (!expanded) {
        return (
            <TouchableOpacity
                onPress={() => onExpandedChange(true)}
                accessibilityRole="button"
                accessibilityLabel={t('common.search')}
                testID={testID}
                className="h-9 w-9 items-center justify-center"
            >
                <AppIcon name="search" size={22} color={colors.gray500} />
            </TouchableOpacity>
        );
    }

    return (
        <View className="flex-1 flex-row items-center">
            <View className="flex-1 flex-row items-center rounded-full bg-gray-100 px-3 h-9">
                <AppIcon name="search" size={18} color={colors.gray500} />
                <TextInput
                    ref={inputRef}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder ?? t('groups.search.placeholder')}
                    placeholderTextColor={colors.gray400}
                    className={[
                        'flex-1 text-sm text-gray-900 mx-2',
                        rtlTextClassName(isRtl),
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="search"
                    style={resolveAutoTextInputStyle(isRtl)}
                    testID={testID ? `${testID}-input` : undefined}
                />
            </View>
            <TouchableOpacity
                onPress={() => {
                    onChangeText('');
                    inputRef.current?.blur();
                    onExpandedChange(false);
                }}
                accessibilityRole="button"
                className="px-3 h-9 items-center justify-center"
                testID={testID ? `${testID}-cancel` : undefined}
            >
                <Text className="text-sm font-medium text-gray-600">
                    {t('groups.search.cancel')}
                </Text>
            </TouchableOpacity>
        </View>
    );
}
