import { useEffect, useState } from 'react';
import { resolveExpenseReceiptDisplayUrl } from '../services/receiptStorage.service';

/** Signed URL for rendering a private expense-receipt object. */
export function useExpenseReceiptDisplayUrl(stored: string | null | undefined): string | null {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setUrl(null);
        if (!stored?.trim()) return;

        void resolveExpenseReceiptDisplayUrl(stored).then((signed) => {
            if (!cancelled) setUrl(signed);
        });

        return () => {
            cancelled = true;
        };
    }, [stored]);

    return url;
}
