import { createClient } from '@/utils/supabase/server';

type Props = { searchParams: Promise<{ token?: string }> };

export default async function EmailUnsubscribePage({ searchParams }: Props) {
    const { token } = await searchParams;
    let ok = false;
    if (token && token.length >= 16) {
        const supabase = await createClient();
        const { data } = await supabase.rpc('unsubscribe_email_by_token', { p_token: token });
        ok = data === true;
    }

    return (
        <main
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'sans-serif',
                background: '#f9fafb',
                padding: 24,
                textAlign: 'center',
            }}
        >
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                {ok ? 'You’re unsubscribed' : 'Link invalid or expired'}
            </h1>
            <p style={{ color: '#6b7280', fontSize: 14, maxWidth: 420 }}>
                {ok
                    ? 'You will no longer receive lifecycle emails from KupaPay. You can turn email back on in the app under Settings → Notifications.'
                    : 'Open KupaPay → Settings → Notifications to manage email preferences.'}
            </p>
        </main>
    );
}
