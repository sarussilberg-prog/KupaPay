/**
 * EditExpenseScreen
 * Form to edit an existing expense
 * Uses NativeWind styling only, full i18n support
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ExpenseCategory } from '@cost-share/shared';
import { useLoading } from '../../hooks/useLoading';
import { getExpenseById, updateExpense, deleteExpense } from '../../services/expenses.service';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { CategoryPicker } from '../../components/CategoryPicker';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { ConfirmDialog } from '../../components/ConfirmDialog';

export function EditExpenseScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { expenseId } = route.params;
    const { isLoading, startLoading, stopLoading } = useLoading();

    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<ExpenseCategory>('other');
    const [loading, setLoading] = useState(true);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [descriptionError, setDescriptionError] = useState('');
    const [amountError, setAmountError] = useState('');

    useEffect(() => {
        const loadExpense = async () => {
            const expense = await getExpenseById(expenseId);
            if (expense) {
                setDescription(expense.description);
                setAmount(expense.amount.toString());
                setCategory(expense.category || 'other');
            }
            setLoading(false);
        };
        void loadExpense();
    }, [expenseId]);

    const validateForm = (): boolean => {
        let valid = true;

        if (!description.trim()) {
            setDescriptionError(t('expenses.descriptionRequired'));
            valid = false;
        } else {
            setDescriptionError('');
        }

        const parsedAmount = parseFloat(amount);
        if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
            setAmountError(t('expenses.invalidAmount'));
            valid = false;
        } else {
            setAmountError('');
        }

        return valid;
    };

    const handleUpdate = async () => {
        if (!validateForm()) return;

        startLoading();
        const result = await updateExpense(expenseId, {
            description: description.trim(),
            amount: parseFloat(amount),
            category,
        });
        stopLoading();

        if (result) {
            navigation.goBack();
        }
    };

    const handleDelete = async () => {
        setShowDeleteDialog(false);
        startLoading();
        const success = await deleteExpense(expenseId);
        stopLoading();

        if (success) {
            navigation.goBack();
        }
    };

    if (loading) {
        return <LoadingIndicator />;
    }

    return (
        <ScrollView className="flex-1 bg-slate-50">
            <View className="p-4">
                {/* Description */}
                <Input
                    label={t('expenses.description')}
                    placeholder={t('expenses.enterDescription')}
                    value={description}
                    onChangeText={(text) => {
                        setDescription(text);
                        if (descriptionError) setDescriptionError('');
                    }}
                    error={descriptionError}
                />

                {/* Amount */}
                <Input
                    label={t('expenses.amount')}
                    placeholder="0.00"
                    value={amount}
                    onChangeText={(text) => {
                        setAmount(text);
                        if (amountError) setAmountError('');
                    }}
                    error={amountError}
                    keyboardType="decimal-pad"
                />

                {/* Category */}
                <CategoryPicker
                    value={category}
                    onChange={setCategory}
                    label={t('expenses.category')}
                />

                {/* Action Buttons */}
                <View className="mt-4 gap-2">
                    <Button
                        title={t('common.save')}
                        onPress={handleUpdate}
                        loading={isLoading}
                        disabled={isLoading}
                    />
                    <Button
                        title={t('common.delete')}
                        onPress={() => setShowDeleteDialog(true)}
                        variant="danger"
                    />
                    <Button
                        title={t('common.cancel')}
                        onPress={() => navigation.goBack()}
                        variant="outline"
                    />
                </View>
            </View>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                visible={showDeleteDialog}
                title={t('expenses.deleteExpense')}
                message={t('expenses.deleteExpenseConfirm')}
                confirmText={t('common.delete')}
                cancelText={t('common.cancel')}
                onConfirm={handleDelete}
                onCancel={() => setShowDeleteDialog(false)}
                destructive
            />
        </ScrollView>
    );
}
