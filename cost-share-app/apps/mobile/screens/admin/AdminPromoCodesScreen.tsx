import React, { useCallback, useEffect, useState } from 'react';
import {
    FlatList,
    Modal,
    Pressable,
    RefreshControl,
    TextInput,
    View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../../components/AppText';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { showSuccessMessage } from '../../lib/appToast';
import { handleError } from '../../lib/handleError';
import {
    createAdminPromoCode,
    listAdminPromoCodes,
    setAdminPromoCodeActive,
    type AdminPromoCodeRow,
} from '../../services/admin.service';
import { colors } from '../../theme';

export function AdminPromoCodesScreen() {
    const { t } = useTranslation();
    const [rows, setRows] = useState<AdminPromoCodeRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [deactivateTarget, setDeactivateTarget] = useState<AdminPromoCodeRow | null>(null);
    const [code, setCode] = useState('');
    const [durationDays, setDurationDays] = useState('14');
    const [maxUses, setMaxUses] = useState('');
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        setRows(await listAdminPromoCodes());
    }, []);

    useEffect(() => {
        void (async () => {
            await load();
            setLoading(false);
        })();
    }, [load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await load();
        } finally {
            setRefreshing(false);
        }
    }, [load]);

    const onCreate = useCallback(async () => {
        const days = Number.parseInt(durationDays, 10);
        if (!Number.isFinite(days) || days < 1) return;
        const max = maxUses.trim() ? Number.parseInt(maxUses, 10) : null;
        setCreating(true);
        const result = await createAdminPromoCode({
            code,
            durationDays: days,
            maxUses: max != null && Number.isFinite(max) ? max : null,
        });
        setCreating(false);
        if (result.ok) {
            setCreateOpen(false);
            setCode('');
            setMaxUses('');
            showSuccessMessage('admin.promoCodes.createSuccess');
            await load();
            return;
        }
        handleError(new Error(`createAdminPromoCode: ${result.error}`), {
            toast: {
                titleKey:
                    result.error === 'not_authorized'
                        ? 'admin.errors.notAuthorized'
                        : 'admin.promoCodes.createError',
            },
            tags: { service: 'admin', op: 'createPromoCode' },
        });
    }, [code, durationDays, load, maxUses]);

    const onConfirmDeactivate = useCallback(async () => {
        if (!deactivateTarget) return;
        const target = deactivateTarget;
        setDeactivateTarget(null);
        const ok = await setAdminPromoCodeActive(target.id, false);
        if (ok) {
            showSuccessMessage('admin.promoCodes.deactivateSuccess');
            await load();
        } else {
            handleError(new Error('setAdminPromoCodeActive failed'), {
                toast: { titleKey: 'admin.promoCodes.deactivateError' },
                tags: { service: 'admin', op: 'deactivatePromoCode' },
            });
        }
    }, [deactivateTarget, load]);

    if (!loading && rows.length === 0 && !createOpen) {
        return (
            <View className="flex-1 bg-slate-50 px-4 pt-4">
                <Text className="text-gray-500 text-center mb-4">{t('admin.promoCodes.empty')}</Text>
                <Button
                    title={t('admin.promoCodes.createCta')}
                    onPress={() => setCreateOpen(true)}
                    testID="admin-promo-create-open"
                />
                <CreatePromoModal
                    visible={createOpen}
                    code={code}
                    durationDays={durationDays}
                    maxUses={maxUses}
                    creating={creating}
                    onChangeCode={setCode}
                    onChangeDuration={setDurationDays}
                    onChangeMaxUses={setMaxUses}
                    onClose={() => setCreateOpen(false)}
                    onSubmit={() => void onCreate()}
                />
            </View>
        );
    }

    return (
        <View className="flex-1 bg-slate-50">
            <View className="px-4 py-3">
                <Button
                    title={t('admin.promoCodes.createCta')}
                    onPress={() => setCreateOpen(true)}
                    testID="admin-promo-create-open"
                />
            </View>
            <FlatList
                data={rows}
                keyExtractor={r => r.id}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 24 }}
                renderItem={({ item }) => (
                    <View className="bg-white rounded-xl px-4 py-3 mb-2">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-base font-semibold text-gray-900">{item.code}</Text>
                            <Text
                                className={`text-xs font-medium ${item.active ? 'text-green-700' : 'text-gray-400'}`}
                            >
                                {item.active
                                    ? t('admin.promoCodes.statusActive')
                                    : t('admin.promoCodes.statusInactive')}
                            </Text>
                        </View>
                        <Text className="text-xs text-gray-500 mt-1">
                            {t('admin.promoCodes.metaLine', {
                                days: item.durationDays,
                                uses: item.useCount,
                                max: item.maxUses ?? t('admin.promoCodes.unlimited'),
                            })}
                        </Text>
                        {item.active ? (
                            <Pressable
                                onPress={() => setDeactivateTarget(item)}
                                className="mt-2 self-start"
                                testID={`admin-promo-deactivate-${item.id}`}
                            >
                                <Text className="text-sm font-semibold text-red-600">
                                    {t('admin.promoCodes.deactivateCta')}
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>
                )}
            />

            <CreatePromoModal
                visible={createOpen}
                code={code}
                durationDays={durationDays}
                maxUses={maxUses}
                creating={creating}
                onChangeCode={setCode}
                onChangeDuration={setDurationDays}
                onChangeMaxUses={setMaxUses}
                onClose={() => setCreateOpen(false)}
                onSubmit={() => void onCreate()}
            />

            <ConfirmDialog
                visible={deactivateTarget != null}
                title={t('admin.promoCodes.deactivateTitle', { code: deactivateTarget?.code ?? '' })}
                message={t('admin.promoCodes.deactivateMessage')}
                confirmText={t('admin.promoCodes.deactivateConfirm')}
                cancelText={t('common.cancel')}
                destructive
                onConfirm={() => void onConfirmDeactivate()}
                onCancel={() => setDeactivateTarget(null)}
            />
        </View>
    );
}

type CreatePromoModalProps = Readonly<{
    visible: boolean;
    code: string;
    durationDays: string;
    maxUses: string;
    creating: boolean;
    onChangeCode: (v: string) => void;
    onChangeDuration: (v: string) => void;
    onChangeMaxUses: (v: string) => void;
    onClose: () => void;
    onSubmit: () => void;
}>;

function CreatePromoModal({
    visible,
    code,
    durationDays,
    maxUses,
    creating,
    onChangeCode,
    onChangeDuration,
    onChangeMaxUses,
    onClose,
    onSubmit,
}: CreatePromoModalProps) {
    const { t } = useTranslation();
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View className="flex-1 justify-end bg-black/40">
                <View className="bg-white rounded-t-3xl px-4 pt-4 pb-8 gap-3">
                    <Text className="text-lg font-bold text-gray-900">{t('admin.promoCodes.createTitle')}</Text>
                    <TextInput
                        value={code}
                        onChangeText={onChangeCode}
                        placeholder={t('admin.promoCodes.codePlaceholder')}
                        placeholderTextColor={colors.gray400}
                        autoCapitalize="characters"
                        className="border border-gray-200 rounded-xl px-4 py-3 text-base"
                        testID="admin-promo-code-input"
                    />
                    <TextInput
                        value={durationDays}
                        onChangeText={onChangeDuration}
                        placeholder={t('admin.promoCodes.durationPlaceholder')}
                        placeholderTextColor={colors.gray400}
                        keyboardType="number-pad"
                        className="border border-gray-200 rounded-xl px-4 py-3 text-base"
                        testID="admin-promo-duration-input"
                    />
                    <TextInput
                        value={maxUses}
                        onChangeText={onChangeMaxUses}
                        placeholder={t('admin.promoCodes.maxUsesPlaceholder')}
                        placeholderTextColor={colors.gray400}
                        keyboardType="number-pad"
                        className="border border-gray-200 rounded-xl px-4 py-3 text-base"
                        testID="admin-promo-max-uses-input"
                    />
                    <View className="flex-row gap-3 mt-2">
                        <Button title={t('common.cancel')} variant="secondary" onPress={onClose} className="flex-1" />
                        <Button
                            title={t('admin.promoCodes.createConfirm')}
                            onPress={onSubmit}
                            loading={creating}
                            disabled={creating || code.trim().length < 4}
                            className="flex-1"
                            testID="admin-promo-create-submit"
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
}
