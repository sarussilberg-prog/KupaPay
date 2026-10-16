/** First-touch marketing attribution (#424). No PII — coarse channel labels only. */

export const MARKETING_ATTRIBUTION_PROPERTY_KEYS = {
    channel: 'acquisition_channel',
    utmSource: 'utm_source',
    utmMedium: 'utm_medium',
    utmCampaign: 'utm_campaign',
    utmContent: 'utm_content',
    utmTerm: 'utm_term',
    installReferrer: 'install_referrer',
    appleSearchAdsCampaign: 'apple_search_ads_campaign',
} as const;

export type MarketingAttribution = {
    channel: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    installReferrer?: string;
    appleSearchAdsCampaign?: string;
};

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

function pickUtm(params: URLSearchParams, key: string): string | undefined {
    const v = params.get(key)?.trim();
    return v ? v.slice(0, 120) : undefined;
}

/** Parse UTM + ASA (`pt`/`ct`) + coarse channel from a URL or query string. */
export function parseMarketingAttributionFromUrl(urlOrSearch: string): MarketingAttribution | null {
    if (!urlOrSearch.trim()) return null;
    let params: URLSearchParams;
    try {
        if (urlOrSearch.startsWith('?')) {
            params = new URLSearchParams(urlOrSearch);
        } else {
            const parsed = new URL(urlOrSearch);
            params = parsed.searchParams;
        }
    } catch {
        return null;
    }

    const utmSource = pickUtm(params, 'utm_source');
    const utmMedium = pickUtm(params, 'utm_medium');
    const utmCampaign = pickUtm(params, 'utm_campaign');
    const utmContent = pickUtm(params, 'utm_content');
    const utmTerm = pickUtm(params, 'utm_term');
    const pt = pickUtm(params, 'pt');
    const ct = pickUtm(params, 'ct');
    const appleSearchAdsCampaign =
        pt && ct ? `${pt}:${ct}`.slice(0, 120) : pt ?? ct ?? undefined;

    const hasUtm = UTM_KEYS.some(k => params.has(k));
    if (!hasUtm && !appleSearchAdsCampaign) {
        return null;
    }

    const channel =
        utmSource ??
        (appleSearchAdsCampaign ? 'apple_search_ads' : undefined) ??
        'unknown';

    return {
        channel,
        utmSource,
        utmMedium,
        utmCampaign,
        utmContent,
        utmTerm,
        appleSearchAdsCampaign,
    };
}

export function marketingAttributionToPostHogProperties(
    attr: MarketingAttribution,
): Record<string, string> {
    const out: Record<string, string> = {
        [MARKETING_ATTRIBUTION_PROPERTY_KEYS.channel]: attr.channel,
    };
    if (attr.utmSource) out[MARKETING_ATTRIBUTION_PROPERTY_KEYS.utmSource] = attr.utmSource;
    if (attr.utmMedium) out[MARKETING_ATTRIBUTION_PROPERTY_KEYS.utmMedium] = attr.utmMedium;
    if (attr.utmCampaign) out[MARKETING_ATTRIBUTION_PROPERTY_KEYS.utmCampaign] = attr.utmCampaign;
    if (attr.utmContent) out[MARKETING_ATTRIBUTION_PROPERTY_KEYS.utmContent] = attr.utmContent;
    if (attr.utmTerm) out[MARKETING_ATTRIBUTION_PROPERTY_KEYS.utmTerm] = attr.utmTerm;
    if (attr.installReferrer) {
        out[MARKETING_ATTRIBUTION_PROPERTY_KEYS.installReferrer] = attr.installReferrer;
    }
    if (attr.appleSearchAdsCampaign) {
        out[MARKETING_ATTRIBUTION_PROPERTY_KEYS.appleSearchAdsCampaign] =
            attr.appleSearchAdsCampaign;
    }
    return out;
}

/** Keep earliest non-empty attribution (first touch). */
export function mergeMarketingAttribution(
    existing: MarketingAttribution | null,
    incoming: MarketingAttribution | null,
): MarketingAttribution | null {
    if (!existing) return incoming;
    if (!incoming) return existing;
    return existing;
}
