/**
 * Shared decision for which empty-state a data list should render.
 *
 * Only relevant once a list has resolved to zero visible items (callers guard
 * their own loading state first). Offline takes precedence over a generic load
 * error: when the device is offline the honest, actionable message is "you're
 * offline — here's what you can still do", not a bare "failed to load".
 */
export type EmptyStateVariant = 'offline' | 'error' | 'empty';

export function resolveEmptyStateVariant(input: {
    online: boolean;
    hasError: boolean;
}): EmptyStateVariant {
    if (!input.online) return 'offline';
    if (input.hasError) return 'error';
    return 'empty';
}
