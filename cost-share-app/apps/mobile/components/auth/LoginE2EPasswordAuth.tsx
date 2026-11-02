/**
 * Dev/CI-only email+password sign-in for Maestro device UI tests (seeded E2E user).
 * Gated by EXPO_PUBLIC_E2E_MAESTRO_AUTH — never enabled in store builds.
 */

import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Text } from '../AppText';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store';
import { colors } from '../../theme';

const defaultEmail =
    (process.env.EXPO_PUBLIC_E2E_TEST_EMAIL ?? 'e2e-playwright@kupay-dev.test').trim();

export function LoginE2EPasswordAuth() {
    const setSession = useAppStore((s) => s.setSession);
    const [email, setEmail] = useState(defaultEmail);
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const onSubmit = async () => {
        setBusy(true);
        setError(null);
        try {
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password,
            });
            if (signInError || !data.session) {
                setError(signInError?.message ?? 'Sign-in failed');
                return;
            }
            setSession(data.session);
        } finally {
            setBusy(false);
        }
    };

    return (
        <View testID="login-e2e-panel" style={styles.panel}>
            <Text className="text-xs font-medium text-gray-500 mb-2">E2E sign-in (CI only)</Text>
            <TextInput
                testID="login-e2e-email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                style={styles.input}
            />
            <TextInput
                testID="login-e2e-password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                style={styles.input}
            />
            {error ? (
                <Text testID="login-e2e-error" className="text-xs text-red-600 mb-2">
                    {error}
                </Text>
            ) : null}
            <TouchableOpacity
                testID="login-e2e-submit"
                onPress={() => void onSubmit()}
                disabled={busy || !password}
                style={[styles.submit, busy || !password ? styles.submitDisabled : null]}
            >
                <Text className="text-sm font-semibold text-white">
                    {busy ? '…' : 'E2E sign in'}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    panel: {
        marginTop: 16,
        padding: 12,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border.default,
        backgroundColor: colors.gray50,
    },
    input: {
        borderWidth: 1,
        borderColor: colors.border.default,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: Platform.OS === 'android' ? 8 : 10,
        marginBottom: 8,
        fontSize: 15,
        backgroundColor: colors.white,
    },
    submit: {
        backgroundColor: colors.primary,
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
    },
    submitDisabled: {
        opacity: 0.5,
    },
});
