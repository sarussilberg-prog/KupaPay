/**
 * Email + password sign-in (Supabase). Used by Maestro device UI and manual QA on simulators.
 */

import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Text } from '../AppText';
import { supabase } from '../../lib/supabase';
import { useAppStore } from '../../store';
import { colors } from '../../theme';

export function LoginE2EPasswordAuth() {
    const setSession = useAppStore((s) => s.setSession);
    const [email, setEmail] = useState('');
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
        <View testID="login-password-panel" style={styles.panel}>
            <Text className="text-xs font-medium text-gray-500 mb-2">Email and password</Text>
            <TextInput
                testID="login-password-email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                placeholder="Email"
                style={styles.input}
            />
            <TextInput
                testID="login-password-field"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoComplete="password"
                placeholder="Password"
                style={styles.input}
            />
            {error ? (
                <Text testID="login-password-error" className="text-xs text-red-600 mb-2">
                    {error}
                </Text>
            ) : null}
            <TouchableOpacity
                testID="login-password-submit"
                onPress={() => void onSubmit()}
                disabled={busy || !email.trim() || !password}
                style={[styles.submit, busy || !email.trim() || !password ? styles.submitDisabled : null]}
            >
                <Text className="text-sm font-semibold text-white">
                    {busy ? '…' : 'Sign in'}
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
