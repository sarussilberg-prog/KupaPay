import type { SplitCalculatorExpense, SplitCalculatorParticipant } from './splitCalculatorLogic';

export type SplitCalculatorSharePayload = {
    currency: string;
    participants: SplitCalculatorParticipant[];
    expenses: SplitCalculatorExpense[];
};

const SHARE_HASH_PREFIX = 'data=';

function toBase64Url(json: string): string {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(json, 'utf8')
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const b of bytes) {
        binary += String.fromCharCode(b);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(encoded: string): string {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const base64 = padded + '='.repeat(padLen);
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(base64, 'base64').toString('utf8');
    }
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
}

export function encodeSplitCalculatorShare(payload: SplitCalculatorSharePayload): string {
    const json = JSON.stringify(payload);
    return `${SHARE_HASH_PREFIX}${toBase64Url(json)}`;
}

export function decodeSplitCalculatorShare(hash: string): SplitCalculatorSharePayload | null {
    const trimmed = hash.startsWith('#') ? hash.slice(1) : hash;
    if (!trimmed.startsWith(SHARE_HASH_PREFIX)) {
        return null;
    }
    try {
        const json = fromBase64Url(trimmed.slice(SHARE_HASH_PREFIX.length));
        const parsed = JSON.parse(json) as SplitCalculatorSharePayload;
        if (!parsed || !Array.isArray(parsed.participants) || !Array.isArray(parsed.expenses)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}
