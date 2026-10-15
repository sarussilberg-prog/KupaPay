/** Compare dotted semver segments (no prerelease). Returns true if `current` < `minimum`. */
export function isAppVersionBelowMinimum(current: string, minimum: string): boolean {
    const parse = (v: string): [number, number, number] => {
        const parts = v.trim().split('.');
        const major = Number.parseInt(parts[0] ?? '0', 10);
        const minor = Number.parseInt(parts[1] ?? '0', 10);
        const patch = Number.parseInt(parts[2] ?? '0', 10);
        return [
            Number.isFinite(major) ? major : 0,
            Number.isFinite(minor) ? minor : 0,
            Number.isFinite(patch) ? patch : 0,
        ];
    };

    const [cM, cm, cp] = parse(current);
    const [mM, mm, mp] = parse(minimum);

    if (cM !== mM) return cM < mM;
    if (cm !== mm) return cm < mm;
    return cp < mp;
}
