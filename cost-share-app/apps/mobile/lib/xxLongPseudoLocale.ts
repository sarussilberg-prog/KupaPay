/**
 * Pseudo-locale string expansion (~40% longer + accents, Android en-XA style).
 * Used for E2E overflow testing when EXPO_PUBLIC_E2E_XX_LONG_LOCALE=true.
 */

const ACCENT_MAP: Record<string, string> = {
    a: 'à',
    e: 'é',
    i: 'í',
    o: 'ó',
    u: 'ú',
    A: 'À',
    E: 'É',
    I: 'Í',
    O: 'Ó',
    U: 'Ú',
};

function expandPlainSegment(segment: string): string {
    const withAccents = segment.replace(/[aeiouAEIOU]/g, ch => ACCENT_MAP[ch] ?? ch);
    const targetLen = Math.ceil(withAccents.length * 1.4);
    if (withAccents.length >= targetLen) return withAccents;

    const pad = ' ··';
    let out = withAccents;
    while (out.length < targetLen) {
        out += pad;
    }
    return out.slice(0, targetLen);
}

export function expandPseudoLongString(value: string): string {
    if (typeof value !== 'string' || value.length === 0) return value;
    if (/^\{\{[\w.]+\}\}$/.test(value.trim())) return value;

    const parts = value.split(/(\{\{[\w.]+\}\})/g);
    const expanded = parts.map(part =>
        /^\{\{[\w.]+\}\}$/.test(part) ? part : expandPlainSegment(part),
    );
    return expanded.join('');
}

export function expandPseudoLongJson(node: unknown): unknown {
    if (typeof node === 'string') return expandPseudoLongString(node);
    if (Array.isArray(node)) return node.map(expandPseudoLongJson);
    if (node && typeof node === 'object') {
        const out: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(node)) {
            out[key] = expandPseudoLongJson(val);
        }
        return out;
    }
    return node;
}
