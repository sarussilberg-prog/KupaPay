import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

async function submitSupportMessage(formData: FormData) {
  'use server';
  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const message = formData.get('message') as string;

  if (!name?.trim() || !email?.trim() || !message?.trim()) return;

  const supabase = await createClient();
  await supabase.from('support_messages').insert({ name, email, message });
  redirect('/support?sent=1');
}

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#f9fafb' }}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '40px 36px', width: '100%', maxWidth: '440px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#111827' }}>Need help?</h1>
        <p style={{ color: '#6b7280', marginBottom: '28px', fontSize: '15px' }}>We're here for you. Send us a message and we'll get back to you within 24 hours.</p>

        {sent ? (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '16px', color: '#15803d', textAlign: 'center' }}>
            Message sent! We'll be in touch soon.
          </div>
        ) : (
          <form action={submitSupportMessage} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Your name</label>
              <input
                name="name"
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Email</label>
              <input
                name="email"
                type="email"
                required
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Message</label>
              <textarea
                name="message"
                required
                rows={5}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '15px', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <button
              type="submit"
              style={{ padding: '12px', background: '#1a1a2e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' }}
            >
              Send Message
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
