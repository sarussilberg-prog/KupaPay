/**
 * Supabase Storage helpers for mobile uploads
 */

import { supabase } from '../lib/supabase';

const GROUP_IMAGES_BUCKET = 'group-images';

function extensionFromUri(uri: string): string {
    const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match?.[1]?.toLowerCase() ?? 'jpg';
}

function contentTypeFromExtension(ext: string): string {
    switch (ext) {
        case 'png':
            return 'image/png';
        case 'webp':
            return 'image/webp';
        case 'gif':
            return 'image/gif';
        default:
            return 'image/jpeg';
    }
}

export async function uploadGroupImage(
    groupId: string,
    localUri: string
): Promise<string | null> {
    const ext = extensionFromUri(localUri);
    const path = `${groupId}/avatar.${ext}`;
    const contentType = contentTypeFromExtension(ext);

    const response = await fetch(localUri);
    const blob = await response.blob();

    const { error } = await supabase.storage
        .from(GROUP_IMAGES_BUCKET)
        .upload(path, blob, { contentType, upsert: true });

    if (error) {
        console.error('Failed to upload group image:', error.message);
        return null;
    }

    const { data } = supabase.storage
        .from(GROUP_IMAGES_BUCKET)
        .getPublicUrl(path);

    return `${data.publicUrl}?t=${Date.now()}`;
}
