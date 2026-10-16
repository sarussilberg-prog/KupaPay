import { renderHook } from '@testing-library/react-native';
import { useAuthUserId } from '../../hooks/useAuthUserId';
import { useAppStore } from '../../store';

describe('useAuthUserId', () => {
    it('prefers hydrated currentUser over session', () => {
        useAppStore.setState({
            currentUser: { id: 'from-profile' } as never,
            session: { user: { id: 'from-session' } } as never,
        });
        const { result } = renderHook(() => useAuthUserId());
        expect(result.current).toBe('from-profile');
    });

    it('falls back to session user id when profile is not hydrated yet', () => {
        useAppStore.setState({
            currentUser: null,
            session: { user: { id: 'from-session' } } as never,
        });
        const { result } = renderHook(() => useAuthUserId());
        expect(result.current).toBe('from-session');
    });
});
