import { useQuery } from '@tanstack/react-query';
import { listSupportMessages } from '../../services/admin.service';
import { queryKeys } from './keys';

export function useAdminSupportMessagesQuery() {
    return useQuery({
        queryKey: queryKeys.adminSupportMessages,
        queryFn: listSupportMessages,
        staleTime: 30_000,
    });
}
