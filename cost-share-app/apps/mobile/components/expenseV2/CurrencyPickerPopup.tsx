/**
 * CurrencyPickerPopup — centered modal listing the currencies in which
 * the debtor currently owes the creditor. Tapping a row confirms and closes.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { colors } from '../../theme';

export interface CurrencyPickerOption {
    currency: string;
    amount: number;
}

export interface CurrencyPickerPopupProps {
    visible: boolean;
    options: ReadonlyArray<CurrencyPickerOption>;
    selectedCurrency: string;
    onCancel: () => void;
    onConfirm: (option: CurrencyPickerOption) => void;
}

const formatOwed = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : '0.00');

export function CurrencyPickerPopup({
    visible,
    options,
    selectedCurrency,
    onCancel,
    onConfirm,
}: CurrencyPickerPopupProps) {
    const { t } = useTranslation();

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onCancel}
        >
            <Pressable
                style={styles.backdrop}
                onPress={onCancel}
                testID="currency-picker-popup"
            >
                <Pressable
                    style={styles.card}
                    onPress={e => e.stopPropagation()}
                >
                    <View style={styles.header}>
                        <Pressable
                            onPress={onCancel}
                            style={styles.headerSide}
                            testID="currency-picker-cancel"
                        >
                            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
                        </Pressable>
                        <Text style={styles.title}>
                            {t('settleUp.currencyPickerTitle')}
                        </Text>
                        <View style={styles.headerSide} />
                    </View>

                    <ScrollView style={styles.list}>
                        {options.map(option => {
                            const isSelected = option.currency === selectedCurrency;
                            return (
                                <Pressable
                                    key={option.currency}
                                    onPress={() => onConfirm(option)}
                                    style={[
                                        styles.row,
                                        isSelected && styles.rowSelected,
                                    ]}
                                    testID={`currency-picker-row-${option.currency}`}
                                >
                                    <View style={styles.rowLeft}>
                                        <Text style={styles.rowCurrency}>
                                            {option.currency}
                                        </Text>
                                        <Text style={styles.rowAmount}>
                                            {t('settleUp.amountOwed', {
                                                amount: `${option.currency} ${formatOwed(option.amount)}`,
                                            })}
                                        </Text>
                                    </View>
                                    {isSelected ? (
                                        <AppIcon
                                            name="checkmark"
                                            size={18}
                                            color={colors.primaryDark}
                                        />
                                    ) : null}
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    card: {
        width: '100%',
        maxWidth: 340,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingVertical: 8,
    },
    headerSide: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        minWidth: 64,
    },
    title: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.72,
        textTransform: 'uppercase',
        color: colors.text.secondary,
    },
    cancelText: {
        fontSize: 15,
        fontWeight: '500',
        color: colors.gray600,
    },
    list: {
        maxHeight: 320,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    rowSelected: {
        backgroundColor: 'rgba(59,130,246,0.06)',
    },
    rowLeft: {
        flex: 1,
    },
    rowCurrency: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text.primary,
    },
    rowAmount: {
        fontSize: 12,
        fontWeight: '500',
        color: colors.text.secondary,
        marginTop: 2,
    },
});
