/**
 * Node entry for pseudo-locale generation (mirrors lib/xxLongPseudoLocale.ts).
 * Used only when EXPO_PUBLIC_E2E_XX_LONG_LOCALE=true in E2E builds.
 */

const ACCENT_MAP = {
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

/** @param {string} value @returns {string} */
export function expandPseudoLongString(value) {
    if (typeof value !== 'string' || value.length === 0) return value;
    if (/^\{\{[\w.]+\}\}$/.test(value.trim())) return value;

    const withAccents = value.replace(/[aeiouAEIOU]/g, (ch) => ACCENT_MAP[ch] ?? ch);
    const targetLen = Math.ceil(withAccents.length * 1.4);
    if (withAccents.length >= targetLen) return withAccents;

    const pad = ' ··';
    let out = withAccents;
    while (out.length < targetLen) {
        out += pad;
    }
    return out.slice(0, targetLen);
}

/** @param {unknown} node @returns {unknown} */
export function expandPseudoLongJson(node) {
    if (typeof node === 'string') return expandPseudoLongString(node);
    if (Array.isArray(node)) return node.map(expandPseudoLongJson);
    if (node && typeof node === 'object') {
        /** @type {Record<string, unknown>} */
        const out = {};
        for (const [key, val] of Object.entries(node)) {
            out[key] = expandPseudoLongJson(val);
        }
        return out;
    }
    return node;
}
