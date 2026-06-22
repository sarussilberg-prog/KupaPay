/**
 * CreateGroupScreen — create or edit a group using the shared form layout.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { TouchableOpacity, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { platformAlert } from '../../lib/platformAlert';
import { handleError } from '../../lib/handleError';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute } from '@react-navigation/native';
import { GroupType, User } from '@cost-share/shared';
import { useLoading } from '../../hooks/useLoading';
import { useAppStore } from '../../store';
import {
    addGroupMember,
    createGroup,
    getGroupById,
    removeGroupMember,
    updateGroup,
} from '../../services/groups.service';
import { fetchSimplifiedInputs } from '../../services/simplifiedDebts.service';
import { deriveSimplifiedDebts } from '@cost-share/shared';
import { fetchGroupUsers } from '../../services/users.service';
import { uploadGroupImage } from '../../services/storage.service';
import { getCurrentUserId } from '../../lib/auth';
import { CreateGroupFloatingButton } from '../../components/groups/CreateGroupFloatingButton';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { AddMembersSheet } from '../../components/AddMembersSheet';
import { Text } from '../../components/AppText';
import { colors } from '../../theme';
import { CreateGroupFormShell } from '../../components/groups/CreateGroupFormShell';
import { CreateGroupFormFields } from '../../components/groups/CreateGroupFormFields';
import { useAppLanguage } from '../../hooks/useRtlLayout';
import { initialCreateGroupCurrency } from '../../lib/appDefaultCurrency';

export function CreateGroupScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const insets = useSafeAreaInsets();
    const groupId: string | undefined = route.params?.groupId;
    const initialMembers: User[] | undefined = route.params?.initialMembers;
    const isEdit = Boolean(groupId);
    const { isLoading, startLoading, stopLoading } = useLoading();
    const currentUser = useAppStore((state) => state.currentUser);
    const appLanguage = useAppLanguage();

    const [name, setName] = useState('');
    const [groupType, setGroupType] = useState<GroupType>('general');
    const [currency, setCurrency] = useState(() =>
        initialCreateGroupCurrency(appLanguage, currentUser),
    );
    const [nameError, setNameError] = useState('');
    const [imageUrl, setImageUrl] = useState<string | undefined>();
    const [localImageUri, setLocalImageUri] = useState<string | null>(null);
    const [imageRemoved, setImageRemoved] = useState(false);
    const [members, setMembers] = useState<User[]>(
        !isEdit && initialMembers ? initialMembers.filter((m) => m.isActive !== false) : [],
    );
    // Edit mode only: members picked but not yet committed. They're added to the
    // backend on Save, so Cancel discards them instead of leaving them in the group.
    const [pendingMembers, setPendingMembers] = useState<User[]>([]);
    // Edit mode only: existing members staged for removal (after the confirm /
    // open-balance guards). They're removed from the backend only on Save.
    const [pendingRemovalIds, setPendingRemovalIds] = useState<Set<string>>(new Set());
    const [addMembersOpen, setAddMembersOpen] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<User | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [unsettledMemberIds, setUnsettledMemberIds] = useState<Set<string>>(new Set());
    const [initialLoading, setInitialLoading] = useState(isEdit);

    useEffect(() => {
        void getCurrentUserId().then(setCurrentUserId);
    }, []);

    const currentUserIdFromStore = useAppStore(s => s.currentUser?.id ?? '');
    const loadMembers = useCallback(async () => {
        if (!groupId) return;
        // fetchSimplifiedInputs now throws on RPC error; the unsettled-member
        // pre-selection is a non-essential hint, so fall back to an empty
        // payload instead of letting it break member loading.
        const [users, payload] = await Promise.all([
            fetchGroupUsers(groupId),
            fetchSimplifiedInputs().catch(() => ({ groups: [] })),
        ]);
        setMembers(users);
        const simplified = currentUserIdFromStore
            ? deriveSimplifiedDebts(payload, currentUserIdFromStore)
            : null;
        const unsettled = new Set<string>();
        simplified?.byGroupCurrency.get(groupId)?.forEach(transfers => {
            transfers.forEach(t => {
                unsettled.add(t.fromUserId);
                unsettled.add(t.toUserId);
            });
        });
        setUnsettledMemberIds(unsettled);
    }, [groupId, currentUserIdFromStore]);

    useEffect(() => {
        if (!isEdit || !groupId) return;
        const loadGroup = async () => {
            const group = await getGroupById(groupId);
            if (group) {
                setName(group.name);
                setGroupType(group.groupType);
                setCurrency(group.defaultCurrency);
                setImageUrl(group.imageUrl);
            }
            await loadMembers();
            setInitialLoading(false);
        };
        void loadGroup();
    }, [isEdit, groupId, loadMembers]);

    const openRemoveDialog = useCallback(
        (m: User) => {
            // Staged addition not yet committed — just drop it locally, no backend call.
            if (pendingMembers.some((p) => p.id === m.id)) {
                setPendingMembers((prev) => prev.filter((x) => x.id !== m.id));
                return;
            }
            if (!groupId) {
                setMembers((prev) => prev.filter((x) => x.id !== m.id));
                return;
            }
            if (unsettledMemberIds.has(m.id)) {
                setRemoveTarget(m);
                return;
            }
            platformAlert(t('groups.removeMemberConfirm'), undefined, [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('groups.removeMember'),
                    style: 'destructive',
                    // Stage the removal; it's committed on Save so Cancel keeps the member.
                    onPress: () => {
                        setPendingRemovalIds((prev) => {
                            const next = new Set(prev);
                            next.add(m.id);
                            return next;
                        });
                    },
                },
            ]);
        },
        [groupId, unsettledMemberIds, t, pendingMembers],
    );

    // Stage picked members locally. Create commits them in createGroup; edit
    // commits them on Save (handleUpdate) so Cancel leaves the group untouched.
    const stageMembers = useCallback(
        (users: User[]) => {
            const active = users.filter((u) => u.isActive !== false);
            if (isEdit) {
                setPendingMembers((prev) => {
                    const existing = new Set([
                        ...members.map((m) => m.id),
                        ...prev.map((m) => m.id),
                    ]);
                    const next = [...prev];
                    active.forEach((u) => {
                        if (!existing.has(u.id)) next.push(u);
                    });
                    return next;
                });
                return;
            }
            setMembers((prev) => {
                const existing = new Set(prev.map((m) => m.id));
                const next = [...prev];
                active.forEach((u) => {
                    if (!existing.has(u.id)) next.push(u);
                });
                return next;
            });
        },
        [isEdit, members],
    );

    const validateForm = (): boolean => {
        if (!name.trim()) {
            setNameError(t('groups.nameRequired'));
            return false;
        }
        setNameError('');
        return true;
    };

    const handleCreate = async () => {
        startLoading();
        try {
            const result = await createGroup({
                name: name.trim(),
                groupType,
                defaultCurrency: currency,
                memberIds: members.map((m) => m.id),
            });
            if (!result) return;

            if (localImageUri) {
                const uploadedUrl = await uploadGroupImage(result.id, localImageUri);
                if (!uploadedUrl) {
                    handleError(new Error('uploadGroupImage returned null'), {
                        toast: { titleKey: 'common.error', messageKey: 'groups.imageUploadError' },
                        tags: { service: 'storage', op: 'uploadGroupImage' },
                        extra: { groupId: result.id, flow: 'create' },
                    });
                } else {
                    await updateGroup(result.id, { imageUrl: uploadedUrl });
                }
            }
            navigation.navigate('Main', {
                screen: 'Groups',
                params: { screen: 'GroupDetail', params: { groupId: result.id } },
            });
        } finally {
            stopLoading();
        }
    };

    const handleUpdate = async () => {
        if (!groupId) return;
        startLoading();
        try {
            let nextImageUrl: string | undefined = imageRemoved ? undefined : imageUrl;

            if (localImageUri) {
                const uploadedUrl = await uploadGroupImage(groupId, localImageUri);
                if (!uploadedUrl) {
                    handleError(new Error('uploadGroupImage returned null'), {
                        toast: { titleKey: 'common.error', messageKey: 'groups.imageUploadError' },
                        tags: { service: 'storage', op: 'uploadGroupImage' },
                        extra: { groupId, flow: 'update' },
                    });
                    return;
                }
                nextImageUrl = uploadedUrl;
            }

            if (localImageUri || imageRemoved) {
                const imageResult = await updateGroup(groupId, {
                    imageUrl: imageRemoved ? '' : nextImageUrl,
                });
                if (!imageResult) return;
            }

            const result = await updateGroup(groupId, {
                name: name.trim(),
                groupType,
                defaultCurrency: currency,
            });
            if (!result) return;

            // Commit staged membership changes only now, on Save.
            for (const id of pendingRemovalIds) {
                await removeGroupMember(groupId, id);
            }
            for (const m of pendingMembers) {
                await addGroupMember(groupId, m.id);
            }

            navigation.goBack();
        } finally {
            stopLoading();
        }
    };

    const handleSubmit = () => {
        if (!validateForm()) return;
        if (isEdit) void handleUpdate();
        else void handleCreate();
    };

    const handleImageChange = (uri: string | null) => {
        setLocalImageUri(uri);
        setImageRemoved(uri === null);
    };

    if (initialLoading) {
        return <LoadingIndicator />;
    }

    const displayMembers: User[] = isEdit
        ? [...members.filter((m) => !pendingRemovalIds.has(m.id)), ...pendingMembers]
        : currentUser
          ? [currentUser, ...members]
          : members;

    const memberIdsForSheet = isEdit
        ? [...members.map((m) => m.id), ...pendingMembers.map((m) => m.id)]
        : [...(currentUser ? [currentUser.id] : []), ...members.map((m) => m.id)];

    const screenTitle = isEdit ? t('groups.editGroup') : t('groups.createGroup');
    const submitLabel = isEdit ? t('common.save') : t('groups.createGroup');

    return (
        <>
            <CreateGroupFormShell
                testID="create-group-screen"
                title={screenTitle}
                extraBottomInset={insets.bottom}
                headerStart={
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        testID="create-group-cancel"
                    >
                        <Text style={{ fontSize: 15, fontWeight: '500', color: colors.gray600 }}>
                            {t('common.cancel')}
                        </Text>
                    </TouchableOpacity>
                }
                headerEnd={
                    <TouchableOpacity
                        onPress={handleSubmit}
                        disabled={isLoading}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        testID="create-group-save-header"
                    >
                        <Text
                            style={{
                                fontSize: 15,
                                fontWeight: '600',
                                color: isLoading ? colors.gray400 : colors.primary,
                            }}
                        >
                            {t('common.save')}
                        </Text>
                    </TouchableOpacity>
                }
                footer={
                    <CreateGroupFloatingButton
                        title={submitLabel}
                        onPress={handleSubmit}
                        loading={isLoading}
                        disabled={isLoading}
                        testID="create-group-submit"
                    />
                }
            >
                <CreateGroupFormFields
                    isEdit={isEdit}
                    name={name}
                    nameError={nameError}
                    onNameChange={(text) => {
                        setName(text);
                        if (nameError) setNameError('');
                    }}
                    groupType={groupType}
                    onGroupTypeChange={setGroupType}
                    currency={currency}
                    onCurrencyChange={setCurrency}
                    imageUrl={isEdit && !imageRemoved ? imageUrl : undefined}
                    localImageUri={localImageUri}
                    onImageChange={handleImageChange}
                    displayMembers={displayMembers}
                    currentUserId={currentUserId}
                    currentUser={currentUser}
                    onAddMembers={() => setAddMembersOpen(true)}
                    onRemoveMember={openRemoveDialog}
                />
            </CreateGroupFormShell>

            <AddMembersSheet
                visible={addMembersOpen}
                groupId={groupId}
                currentMemberIds={memberIdsForSheet}
                onClose={() => setAddMembersOpen(false)}
                onConfirmSelection={stageMembers}
            />

            <Modal
                visible={removeTarget !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setRemoveTarget(null)}
            >
                <Pressable
                    className="flex-1 bg-black/50 justify-center items-center p-4"
                    onPress={() => setRemoveTarget(null)}
                >
                    <Pressable onPress={() => {}} className="bg-white rounded-2xl p-6 w-full max-w-sm">
                        <Text className="text-xl font-bold text-gray-900 mb-2">
                            {t('groups.cannotRemoveMember')}
                        </Text>
                        <Text className="text-base text-gray-600">
                            {t('groups.cannotRemoveMemberReason')}
                        </Text>
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}
