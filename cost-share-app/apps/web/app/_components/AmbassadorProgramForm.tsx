'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { buildAmbassadorReferralUrl } from '@cost-share/shared';
import type { Language, Translations } from '@/lib/i18n';
import { getBrowserSupabaseClient } from '@/utils/supabase/browser';

type AudienceType = 'travel_creator' | 'student_leader';

type ApplicationState =
    | { kind: 'loading' }
    | { kind: 'anonymous' }
    | { kind: 'ready' }
    | { kind: 'pending' }
    | { kind: 'approved'; referralCode: string }
    | { kind: 'rejected' }
    | { kind: 'already_ambassador'; referralCode: string };

function mapRpcError(message: string, t: Translations['ambassadorProgram']): string {
    if (message.includes('not_authenticated')) return t.errors.notAuthenticated;
    if (message.includes('consent_required')) return t.errors.consentRequired;
    if (message.includes('application_pending')) return t.errors.applicationPending;
    if (message.includes('already_ambassador')) return t.errors.alreadyAmbassador;
    return t.errors.generic;
}

export default function AmbassadorProgramForm({
    locale,
    t,
}: Readonly<{ locale: Language; t: Translations }>) {
    const page = t.ambassadorProgram;
    const [state, setState] = useState<ApplicationState>({ kind: 'loading' });
    const [audience, setAudience] = useState<AudienceType>('travel_creator');
    const [link, setLink] = useState('');
    const [message, setMessage] = useState('');
    const [consent, setConsent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const refreshStatus = useCallback(async () => {
        const supabase = getBrowserSupabaseClient();
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
            setState({ kind: 'anonymous' });
            return;
        }
        const { data, error } = await supabase.rpc('get_my_ambassador_application');
        if (error || !data) {
            setState({ kind: 'ready' });
            return;
        }
        const raw = data as {
            is_ambassador?: boolean;
            referral_code?: string;
            application?: { status?: string } | null;
        };
        if (raw.is_ambassador && raw.referral_code) {
            setState({ kind: 'already_ambassador', referralCode: raw.referral_code });
            return;
        }
        const status = raw.application?.status;
        if (status === 'pending') {
            setState({ kind: 'pending' });
            return;
        }
        if (status === 'rejected') {
            setState({ kind: 'rejected' });
            return;
        }
        setState({ kind: 'ready' });
    }, []);

    useEffect(() => {
        void refreshStatus();
        const supabase = getBrowserSupabaseClient();
        const { data: sub } = supabase.auth.onAuthStateChange(() => {
            void refreshStatus();
        });
        return () => sub.subscription.unsubscribe();
    }, [refreshStatus]);

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setFormError(null);
        setSubmitting(true);
        try {
            const supabase = getBrowserSupabaseClient();
            const { error } = await supabase.rpc('submit_ambassador_application', {
                p_audience_type: audience,
                p_primary_link: link,
                p_message: message,
                p_consent: consent,
            });
            if (error) {
                setFormError(mapRpcError(error.message, page));
                return;
            }
            setState({ kind: 'pending' });
        } finally {
            setSubmitting(false);
        }
    }

    if (state.kind === 'loading') {
        return <p className="text-gray-500 text-sm">{page.form.submitting}</p>;
    }

    if (state.kind === 'anonymous') {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
                <p className="text-gray-600 mb-4">{page.form.signInHint}</p>
                <Link
                    href="/login"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-white font-medium hover:bg-blue-700"
                >
                    {page.form.signInCta}
                </Link>
            </div>
        );
    }

    if (state.kind === 'pending') {
        return (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
                <h3 className="font-semibold text-gray-900">{page.status.pendingTitle}</h3>
                <p className="text-gray-600 mt-2 text-sm">{page.status.pendingBody}</p>
            </div>
        );
    }

    if (state.kind === 'rejected') {
        return (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6">
                <h3 className="font-semibold text-gray-900">{page.status.rejectedTitle}</h3>
                <p className="text-gray-600 mt-2 text-sm">{page.status.rejectedBody}</p>
            </div>
        );
    }

    if (state.kind === 'already_ambassador' || state.kind === 'approved') {
        const code = state.referralCode;
        const shareUrl = buildAmbassadorReferralUrl(code, locale);
        return (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6">
                <h3 className="font-semibold text-gray-900">{page.status.approvedTitle}</h3>
                <p className="text-gray-600 mt-2 text-sm">{page.status.approvedBody}</p>
                <p className="text-gray-800 mt-4 font-mono text-lg">{code}</p>
                <p className="text-gray-600 mt-2 text-sm break-all">{shareUrl}</p>
            </div>
        );
    }

    return (
        <form onSubmit={onSubmit} className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">{page.form.title}</h3>
            <fieldset>
                <legend className="text-sm font-medium text-gray-700 mb-2">{page.form.audienceLabel}</legend>
                <label className="flex items-center gap-2 text-sm text-gray-700 mb-2">
                    <input
                        type="radio"
                        name="audience"
                        checked={audience === 'travel_creator'}
                        onChange={() => setAudience('travel_creator')}
                    />
                    {page.form.audienceTravelCreator}
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                        type="radio"
                        name="audience"
                        checked={audience === 'student_leader'}
                        onChange={() => setAudience('student_leader')}
                    />
                    {page.form.audienceStudentLeader}
                </label>
            </fieldset>
            <div>
                <label htmlFor="amb-link" className="block text-sm font-medium text-gray-700 mb-1">
                    {page.form.linkLabel}
                </label>
                <input
                    id="amb-link"
                    type="url"
                    required
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder={page.form.linkPlaceholder}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
            </div>
            <div>
                <label htmlFor="amb-message" className="block text-sm font-medium text-gray-700 mb-1">
                    {page.form.messageLabel}
                </label>
                <textarea
                    id="amb-message"
                    required
                    minLength={10}
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={page.form.messagePlaceholder}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
            </div>
            <label className="flex items-start gap-2 text-sm text-gray-600">
                <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1"
                />
                <span>
                    {page.form.consentLabel}{' '}
                    <Link href="/privacy" className="text-blue-600 hover:underline">
                        {page.form.privacyLink}
                    </Link>
                </span>
            </label>
            {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
            <button
                type="submit"
                disabled={submitting || !consent}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
            >
                {submitting ? page.form.submitting : page.form.submit}
            </button>
        </form>
    );
}
