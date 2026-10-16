/** Opens WhatsApp (app or web) with a prefilled message — no paid API. */
export function buildWhatsAppShareUrl(text: string): string {
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
