import React, { useCallback, useEffect, useState } from 'react';
import { View, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '../AppText';
import { AppIcon } from '../AppIcon';
import { Button } from '../Button';
import { colors } from '../../theme';
import type { AuthError } from '../../services/auth.service';
import { requestEmailOtp, verifyEmailOtp } from '../../services/emailOtpAuth.service';
import { isValidEmailFormat, normalizeEmailInput } from '../../lib/authEmailOtpErrors';

const RESEND_COOLDOWN_SEC = 60;

type Step = 'collapsed' | 'email' | 'code';

type Props = {
    disabled?: boolean;
    onAuthResult: (result: { error: AuthError | null }) => void;
};

export function LoginEmailOtpAuth({ disabled, onAuthResult }: Props) {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>('collapsed');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [resendSeconds, setResendSeconds] = useState(0);
    const [inlineErrorKey, setInlineErrorKey] = useState<string | null>(null);

    useEffect(() => {
        if (resendSeconds <= 0) return undefined;
        const timer = setInterval(() => {
            setResendSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [resendSeconds]);

    const startCooldown = useCallback(() => {
        setResendSeconds(RESEND_COOLDOWN_SEC);
    }, []);

    const mapInlineError = (error: AuthError): string => {
        if (error.code === 'account_deleted' || error.code === 'account_restorable') {
            return error.message;
        }
        if (error.message === 'email_otp_rate_limited') return t('auth.emailOtpRateLimited');
        if (error.message === 'email_otp_invalid_email') return t('auth.emailOtpInvalidEmail');
        if (error.message === 'email_otp_invalid') return t('auth.emailOtpInvalidCode');
        return error.message || t('auth.emailOtpSendError');
    };

    const sendCode = async (targetEmail: string) => {
        setSending(true);
        setInlineErrorKey(null);
        try {
            const { error } = await requestEmailOtp(targetEmail);
            if (error) {
                if (error.code === 'account_deleted' || error.code === 'account_restorable') {
                    onAuthResult({ error });
                    return;
                }
                setInlineErrorKey(mapInlineError(error));
                if (error.message === 'email_otp_rate_limited') {
                    startCooldown();
                }
                return;
            }
            startCooldown();
            setStep('code');
        } finally {
            setSending(false);
        }
    };

    const handleExpand = () => {
        if (disabled) return;
        setStep('email');
        setInlineErrorKey(null);
    };

    const handleSendCode = () => {
        const normalized = normalizeEmailInput(email);
        if (!isValidEmailFormat(normalized)) {
            setInlineErrorKey(t('auth.emailOtpInvalidEmail'));
            return;
        }
        void sendCode(normalized);
    };

    const handleVerify = async () => {
        setVerifying(true);
        setInlineErrorKey(null);
        try {
            const { error } = await verifyEmailOtp(email, code);
            if (error) {
                if (error.code === 'account_deleted' || error.code === 'account_restorable') {
                    onAuthResult({ error });
                    return;
                }
                setInlineErrorKey(mapInlineError(error));
                return;
            }
            onAuthResult({ error: null });
        } finally {
            setVerifying(false);
        }
    };

    const handleResend = () => {
        if (resendSeconds > 0 || sending) return;
        void sendCode(email);
    };

    const isBusy = sending || verifying;
    const controlsDisabled = Boolean(disabled) || isBusy;

    if (step === 'collapsed') {
        return (
            <View className="mt-3" testID="login-email-otp-auth">
                <Button
                    title={t('auth.signInWithEmail')}
                    onPress={handleExpand}
                    variant="outline"
                    disabled={controlsDisabled}
                    testID="login-email-continue-button"
                    icon="mail-outline"
                    iconColor={colors.primaryDark}
                    className="rounded-full border-gray-200 py-3.5"
                />
            </View>
        );
    }

    return (
        <View className="mt-3" testID="login-email-otp-auth">
            {step === 'email' ? (
                <>
                    <View
                        className="flex-row items-center rounded-2xl border border-gray-200 bg-white px-3"
                        style={{ minHeight: 52 }}
                    >
                        <AppIcon name="mail-outline" size={20} color={colors.gray500} />
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            editable={!controlsDisabled}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            placeholder={t('auth.emailPlaceholder')}
                            placeholderTextColor={colors.gray400}
                            className="flex-1 text-base text-gray-900 px-2 py-3"
                            testID="login-email-input"
                        />
                    </View>
                    <View className="mt-2">
                        <Button
                            title={t('auth.emailOtpSendCode')}
                            onPress={handleSendCode}
                            loading={sending}
                            disabled={controlsDisabled || !email.trim()}
                            testID="login-email-send-code-button"
                        />
                    </View>
                </>
            ) : (
                <>
                    <Text className="text-xs text-gray-500 mb-2 text-center">
                        {t('auth.emailOtpSentTo', { email: normalizeEmailInput(email) })}
                    </Text>
                    <View
                        className="flex-row items-center rounded-2xl border border-gray-200 bg-white px-3"
                        style={{ minHeight: 52 }}
                    >
                        <AppIcon name="keypad-outline" size={20} color={colors.gray500} />
                        <TextInput
                            value={code}
                            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                            editable={!controlsDisabled}
                            keyboardType="number-pad"
                            textContentType="oneTimeCode"
                            autoComplete="one-time-code"
                            placeholder={t('auth.emailOtpCodePlaceholder')}
                            placeholderTextColor={colors.gray400}
                            className="flex-1 text-base text-gray-900 px-2 py-3 tracking-widest"
                            testID="login-email-otp-input"
                        />
                    </View>
                    <View className="mt-2">
                        <Button
                            title={t('auth.emailOtpVerify')}
                            onPress={() => void handleVerify()}
                            loading={verifying}
                            disabled={controlsDisabled || code.length !== 6}
                            testID="login-email-verify-button"
                        />
                    </View>
                    <View className="mt-2 flex-row justify-center gap-3">
                        <Button
                            title={
                                resendSeconds > 0
                                    ? t('auth.emailOtpResendIn', { seconds: resendSeconds })
                                    : t('auth.emailOtpResend')
                            }
                            onPress={handleResend}
                            variant="secondary"
                            fullWidth={false}
                            disabled={controlsDisabled || resendSeconds > 0}
                            testID="login-email-resend-button"
                            className="px-4 py-3"
                        />
                        <Button
                            title={t('auth.emailOtpChangeEmail')}
                            onPress={() => {
                                setStep('email');
                                setCode('');
                                setInlineErrorKey(null);
                            }}
                            variant="outline"
                            fullWidth={false}
                            disabled={controlsDisabled}
                            testID="login-email-change-button"
                            className="px-4 py-3"
                        />
                    </View>
                </>
            )}

            {inlineErrorKey ? (
                <Text
                    className="text-sm text-red-500 text-center mt-2"
                    testID="login-email-inline-error"
                >
                    {inlineErrorKey}
                </Text>
            ) : null}
        </View>
    );
}
