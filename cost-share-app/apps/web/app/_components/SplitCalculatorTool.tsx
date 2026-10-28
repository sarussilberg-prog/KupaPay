'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { languageToIntlLocale, type Language } from '@cost-share/shared';
import type { Translations } from '@/lib/i18n';
import {
    computeSplitCalculatorTransfers,
    type SplitCalculatorExpense,
    type SplitCalculatorParticipant,
    type SplitCalculatorResult,
} from '@/lib/splitCalculatorLogic';
import {
    decodeSplitCalculatorShare,
    encodeSplitCalculatorShare,
    type SplitCalculatorSharePayload,
} from '@/lib/splitCalculatorShare';
import StoreDownloadBadges from './StoreDownloadBadges';

type Props = Readonly<{
    locale: Language;
    t: Translations;
}>;

function newId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return `id-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
    }
    return `id-${Date.now()}`;
}

function defaultParticipants(t: Translations): SplitCalculatorParticipant[] {
    return [
        { id: newId(), name: t.splitCalculator.defaults.personA },
        { id: newId(), name: t.splitCalculator.defaults.personB },
    ];
}

function renderCalculatorResults(
    result: SplitCalculatorResult,
    t: Translations,
    money: Intl.NumberFormat,
): React.ReactNode {
    if (!result.ok) {
        return (
            <output className="block text-gray-600">
                {t.splitCalculator.results.errors[result.error]}
            </output>
        );
    }
    if (result.transfers.length === 0) {
        return (
            <output className="block text-gray-600">
                {t.splitCalculator.results.allSettled}
            </output>
        );
    }
    return (
        <ol className="space-y-3">
            {result.transfers.map((row) => (
                <li
                    key={`${row.fromUserId}-${row.toUserId}-${row.amount}`}
                    className="rounded-lg bg-blue-50 px-4 py-3 text-gray-900"
                >
                    {t.splitCalculator.results.transferLine
                        .replace('{from}', row.fromUserName)
                        .replace('{to}', row.toUserName)
                        .replace('{amount}', money.format(row.amount))}
                </li>
            ))}
        </ol>
    );
}

function defaultExpenses(participants: SplitCalculatorParticipant[]): SplitCalculatorExpense[] {
    const payerId = participants[0]?.id ?? newId();
    return [
        {
            id: newId(),
            payerId,
            amount: 100,
            participantIds: participants.map((p) => p.id),
        },
    ];
}

export default function SplitCalculatorTool({ locale, t }: Props) {
    const [participants, setParticipants] = useState<SplitCalculatorParticipant[]>(() =>
        defaultParticipants(t),
    );
    const [expenses, setExpenses] = useState<SplitCalculatorExpense[]>(() =>
        defaultExpenses(defaultParticipants(t)),
    );
    const [currency, setCurrency] = useState('USD');
    const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'error'>('idle');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const shared = decodeSplitCalculatorShare(window.location.hash);
        if (!shared) return;
        setParticipants(shared.participants);
        setExpenses(shared.expenses);
        if (shared.currency) setCurrency(shared.currency);
    }, []);

    const result = useMemo(
        () => computeSplitCalculatorTransfers(participants, expenses, currency),
        [participants, expenses, currency],
    );

    const money = useMemo(() => {
        const intlLocale = languageToIntlLocale(locale);
        return new Intl.NumberFormat(intlLocale, {
            style: 'currency',
            currency: currency.length === 3 ? currency : 'USD',
            maximumFractionDigits: 2,
        });
    }, [locale, currency]);

    const updateParticipantName = (id: string, name: string) => {
        setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
    };

    const addParticipant = () => {
        const created = { id: newId(), name: t.splitCalculator.defaults.newPerson };
        setParticipants((prev) => [...prev, created]);
    };

    const removeParticipant = (id: string) => {
        setParticipants((prev) => (prev.length <= 2 ? prev : prev.filter((p) => p.id !== id)));
        setExpenses((prev) =>
            prev.map((e) => ({
                ...e,
                payerId: e.payerId === id ? participants.find((p) => p.id !== id)?.id ?? e.payerId : e.payerId,
                participantIds: e.participantIds.filter((pid) => pid !== id),
            })),
        );
    };

    const addExpense = () => {
        const payerId = participants[0]?.id;
        if (!payerId) return;
        setExpenses((prev) => [
            ...prev,
            {
                id: newId(),
                payerId,
                amount: 0,
                participantIds: participants.map((p) => p.id),
            },
        ]);
    };

    const updateExpense = (id: string, patch: Partial<SplitCalculatorExpense>) => {
        setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    };

    const removeExpense = (id: string) => {
        setExpenses((prev) => (prev.length <= 1 ? prev : prev.filter((e) => e.id !== id)));
    };

    const toggleExpenseParticipant = (expenseId: string, userId: string) => {
        setExpenses((prev) =>
            prev.map((e) => {
                if (e.id !== expenseId) return e;
                const allIds = participants.map((p) => p.id);
                const current = e.participantIds.length === 0 ? allIds : e.participantIds;
                const has = current.includes(userId);
                const next = has
                    ? current.filter((id) => id !== userId)
                    : [...current, userId];
                if (next.length === 0) return e;
                return { ...e, participantIds: next };
            }),
        );
    };

    const copyShareLink = useCallback(async () => {
        const payload: SplitCalculatorSharePayload = { currency, participants, expenses };
        const hash = encodeSplitCalculatorShare(payload);
        const url = `${window.location.origin}${window.location.pathname}${window.location.search}#${hash}`;
        try {
            window.history.replaceState(null, '', url);
            await navigator.clipboard.writeText(url);
            setShareStatus('copied');
            window.setTimeout(() => setShareStatus('idle'), 2500);
        } catch {
            setShareStatus('error');
        }
    }, [currency, participants, expenses]);

    return (
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
            <header className="space-y-3 text-center sm:text-start">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                    {t.splitCalculator.title}
                </h1>
                <p className="text-lg text-gray-600">{t.splitCalculator.subtitle}</p>
            </header>

            <section aria-labelledby="participants-heading" className="space-y-4">
                <h2 id="participants-heading" className="text-xl font-semibold">
                    {t.splitCalculator.participants.title}
                </h2>
                <ul className="space-y-3">
                    {participants.map((p, index) => (
                        <li key={p.id} className="flex gap-2 items-center">
                            <label className="sr-only" htmlFor={`participant-${p.id}`}>
                                {t.splitCalculator.participants.nameLabel}
                            </label>
                            <input
                                id={`participant-${p.id}`}
                                type="text"
                                value={p.name}
                                onChange={(e) => updateParticipantName(p.id, e.target.value)}
                                className="flex-1 min-h-[44px] rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                autoComplete="name"
                            />
                            <button
                                type="button"
                                onClick={() => removeParticipant(p.id)}
                                disabled={participants.length <= 2}
                                className="min-h-[44px] px-3 text-sm text-red-600 disabled:opacity-40"
                                aria-label={t.splitCalculator.participants.remove}
                            >
                                {t.splitCalculator.participants.remove}
                            </button>
                            <span className="sr-only">{index + 1}</span>
                        </li>
                    ))}
                </ul>
                <button
                    type="button"
                    onClick={addParticipant}
                    className="min-h-[44px] rounded-lg border border-blue-500 px-4 text-blue-600 font-medium hover:bg-blue-50"
                >
                    {t.splitCalculator.participants.add}
                </button>
            </section>

            <section aria-labelledby="expenses-heading" className="space-y-4">
                <div className="flex flex-wrap items-end gap-4 justify-between">
                    <h2 id="expenses-heading" className="text-xl font-semibold">
                        {t.splitCalculator.expenses.title}
                    </h2>
                    <div>
                        <label htmlFor="calc-currency" className="block text-sm text-gray-600 mb-1">
                            {t.splitCalculator.expenses.currency}
                        </label>
                        <input
                            id="calc-currency"
                            type="text"
                            maxLength={3}
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                            className="w-24 min-h-[44px] rounded-lg border border-gray-200 px-3 uppercase"
                            aria-describedby="calc-currency-hint"
                        />
                        <p id="calc-currency-hint" className="text-xs text-gray-500 mt-1">
                            {t.splitCalculator.expenses.currencyHint}
                        </p>
                    </div>
                </div>
                <ul className="space-y-6">
                    {expenses.map((expense) => (
                        <li
                            key={expense.id}
                            className="rounded-xl border border-gray-100 p-4 shadow-sm space-y-3"
                        >
                            <div className="grid sm:grid-cols-2 gap-3">
                                <div>
                                    <label
                                        htmlFor={`amount-${expense.id}`}
                                        className="block text-sm text-gray-600 mb-1"
                                    >
                                        {t.splitCalculator.expenses.amount}
                                    </label>
                                    <input
                                        id={`amount-${expense.id}`}
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        inputMode="decimal"
                                        value={Number.isFinite(expense.amount) ? expense.amount : ''}
                                        onChange={(e) =>
                                            updateExpense(expense.id, {
                                                amount: Number.parseFloat(e.target.value) || 0,
                                            })
                                        }
                                        className="w-full min-h-[44px] rounded-lg border border-gray-200 px-3"
                                    />
                                </div>
                                <div>
                                    <label
                                        htmlFor={`payer-${expense.id}`}
                                        className="block text-sm text-gray-600 mb-1"
                                    >
                                        {t.splitCalculator.expenses.paidBy}
                                    </label>
                                    <select
                                        id={`payer-${expense.id}`}
                                        value={expense.payerId}
                                        onChange={(e) =>
                                            updateExpense(expense.id, { payerId: e.target.value })
                                        }
                                        className="w-full min-h-[44px] rounded-lg border border-gray-200 px-3 bg-white"
                                    >
                                        {participants.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <fieldset>
                                <legend className="text-sm font-medium text-gray-700 mb-2">
                                    {t.splitCalculator.expenses.splitAmong}
                                </legend>
                                <div className="flex flex-wrap gap-2">
                                    {participants.map((p) => {
                                        const activeIds =
                                            expense.participantIds.length === 0
                                                ? participants.map((x) => x.id)
                                                : expense.participantIds;
                                        const checked = activeIds.includes(p.id);
                                        return (
                                            <label
                                                key={p.id}
                                                className="inline-flex items-center gap-2 min-h-[44px] px-3 rounded-full border border-gray-200 cursor-pointer has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() =>
                                                        toggleExpenseParticipant(expense.id, p.id)
                                                    }
                                                    className="size-4"
                                                />
                                                <span>{p.name}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </fieldset>
                            <button
                                type="button"
                                onClick={() => removeExpense(expense.id)}
                                disabled={expenses.length <= 1}
                                className="text-sm text-red-600 disabled:opacity-40"
                            >
                                {t.splitCalculator.expenses.remove}
                            </button>
                        </li>
                    ))}
                </ul>
                <button
                    type="button"
                    onClick={addExpense}
                    className="min-h-[44px] rounded-lg border border-blue-500 px-4 text-blue-600 font-medium hover:bg-blue-50"
                >
                    {t.splitCalculator.expenses.add}
                </button>
            </section>

            <section aria-labelledby="results-heading" className="space-y-4">
                <h2 id="results-heading" className="text-xl font-semibold">
                    {t.splitCalculator.results.title}
                </h2>
                {renderCalculatorResults(result, t, money)}
                {result.ok && result.transfers.length > 0 ? (
                    <p className="text-sm text-gray-500">
                        {t.splitCalculator.results.algorithmNote.replace(
                            '{mode}',
                            result.algorithm === 'exact'
                                ? t.splitCalculator.results.algorithmExact
                                : t.splitCalculator.results.algorithmGreedy,
                        )}
                    </p>
                ) : null}
                <div className="flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={copyShareLink}
                        className="min-h-[44px] rounded-lg bg-blue-500 px-5 text-white font-medium hover:bg-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    >
                        {shareStatus === 'copied'
                            ? t.splitCalculator.share.copied
                            : t.splitCalculator.share.copy}
                    </button>
                    {shareStatus === 'error' ? (
                        <span className="text-sm text-red-600">{t.splitCalculator.share.error}</span>
                    ) : null}
                </div>
            </section>

            <section
                aria-labelledby="cta-heading"
                className="rounded-2xl bg-gray-50 px-6 py-8 text-center space-y-4"
            >
                <h2 id="cta-heading" className="text-2xl font-bold">
                    {t.splitCalculator.cta.title}
                </h2>
                <p className="text-gray-600 max-w-xl mx-auto">{t.splitCalculator.cta.body}</p>
                <StoreDownloadBadges t={t} />
            </section>
        </div>
    );
}
