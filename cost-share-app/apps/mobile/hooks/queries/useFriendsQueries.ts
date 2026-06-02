import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    acceptFriendRequest,
    fetchFriends,
    fetchIncomingRequests,
    fetchOutgoingRequests,
    rejectFriendRequest,
    removeFriend,
    searchUsers,
    sendFriendRequest,
} from '../../services/friends.service';
import { queryKeys } from './keys';

export function useFriendsQuery() {
    return useQuery({
        queryKey: queryKeys.friends,
        queryFn: fetchFriends,
    });
}

export const INCOMING_REQUESTS_STALE_MS = 120_000;

export function useIncomingFriendRequestsQuery() {
    return useQuery({
        queryKey: queryKeys.friendRequestsIncoming,
        queryFn: fetchIncomingRequests,
        staleTime: INCOMING_REQUESTS_STALE_MS,
    });
}

export function useOutgoingFriendRequestsQuery() {
    return useQuery({
        queryKey: queryKeys.friendRequestsOutgoing,
        queryFn: fetchOutgoingRequests,
    });
}

export function useSearchUsersQuery(query: string) {
    const trimmed = query.trim();
    return useQuery({
        queryKey: queryKeys.userSearch(trimmed),
        queryFn: () => searchUsers(trimmed),
        enabled: trimmed.length >= 2,
    });
}

function invalidateAllFriendsKeys(qc: ReturnType<typeof useQueryClient>) {
    void qc.invalidateQueries({ queryKey: queryKeys.friends });
    void qc.invalidateQueries({ queryKey: queryKeys.friendRequestsIncoming });
    void qc.invalidateQueries({ queryKey: queryKeys.friendRequestsOutgoing });
    void qc.invalidateQueries({ queryKey: ['user-search'] });
    void qc.invalidateQueries({ queryKey: ['activity'] });
}

export function useSendFriendRequestMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (toUserId: string) => sendFriendRequest(toUserId),
        onSuccess: () => invalidateAllFriendsKeys(qc),
    });
}

export function useAcceptFriendRequestMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (requestId: string) => acceptFriendRequest(requestId),
        onSuccess: () => invalidateAllFriendsKeys(qc),
    });
}

export function useRejectFriendRequestMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (requestId: string) => rejectFriendRequest(requestId),
        onSuccess: () => invalidateAllFriendsKeys(qc),
    });
}

export function useRemoveFriendMutation() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (otherUserId: string) => removeFriend(otherUserId),
        onSuccess: () => invalidateAllFriendsKeys(qc),
    });
}
