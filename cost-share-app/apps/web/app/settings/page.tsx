import { AppBuildInfoFooter } from '../_components/AppBuildInfoFooter';

export default function SettingsPage() {
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
            }}
        >
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>About this build</h1>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 8, textAlign: 'center' }}>
                Internal version metadata for the web app (same fields as mobile Settings).
            </p>
            <AppBuildInfoFooter />
        </main>
    );
}
