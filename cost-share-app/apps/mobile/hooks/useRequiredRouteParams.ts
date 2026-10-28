import { useRoute } from '@react-navigation/native';

/** Safe read of stack route params (undefined when the navigator omits params). */
export function readRouteParams<T extends Record<string, unknown>>(
    route: { params?: T | undefined },
): Partial<T> {
    return (route.params ?? {}) as Partial<T>;
}

export function hasNonEmptyStringParams<K extends string>(
    params: Partial<Record<K, unknown>>,
    keys: readonly K[],
): params is Record<K, string> {
    return keys.every((key) => {
        const value = params[key];
        return typeof value === 'string' && value.length > 0;
    });
}

/**
 * Reads required string route params for stack screens (deep links, cold restore).
 * Returns `isValid: false` when any key is missing or empty — render RouteParamsFallback.
 */
export function useRequiredRouteParams<K extends string>(requiredKeys: readonly K[]): {
    params: Partial<Record<K, string>>;
    isValid: boolean;
    required: Record<K, string> | null;
} {
    const route = useRoute<any>();
    const raw = readRouteParams(route) as Partial<Record<K, unknown>>;
    const params: Partial<Record<K, string>> = {};
    for (const key of requiredKeys) {
        const value = raw[key];
        if (typeof value === 'string' && value.length > 0) {
            params[key] = value;
        }
    }
    const isValid = hasNonEmptyStringParams(params, requiredKeys);
    return {
        params,
        isValid,
        required: isValid ? (params as Record<K, string>) : null,
    };
}
