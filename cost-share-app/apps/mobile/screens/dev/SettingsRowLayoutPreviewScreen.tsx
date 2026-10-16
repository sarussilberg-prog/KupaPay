import React, { useEffect, useRef } from 'react';
import { useChangeAppLanguage } from '../../hooks/useChangeAppLanguage';
import { SettingsRowLayoutPreview } from '../../dev/SettingsRowLayoutPreview';
import { readSettingsRowPreviewParams } from '../../dev/settingsRowPreviewParams';

/** Web-only dev preview for settings value-row layout (before/after). */
export function SettingsRowLayoutPreviewScreen() {
    const changeLanguage = useChangeAppLanguage();
    const { lang } = readSettingsRowPreviewParams();
    const previewLang = lang === 'en' ? 'en' : 'he';
    const appliedLang = useRef<string | null>(null);

    useEffect(() => {
        if (appliedLang.current === lang) return;
        appliedLang.current = lang;
        void changeLanguage(lang);
    }, [changeLanguage, lang]);

    return <SettingsRowLayoutPreview lang={previewLang} />;
}
