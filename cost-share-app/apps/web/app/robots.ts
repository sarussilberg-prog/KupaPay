import type { MetadataRoute } from 'next';
import { APP_WEB_ORIGIN } from '@cost-share/shared';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
        },
        sitemap: `${APP_WEB_ORIGIN}/sitemap.xml`,
        host: APP_WEB_ORIGIN,
    };
}
