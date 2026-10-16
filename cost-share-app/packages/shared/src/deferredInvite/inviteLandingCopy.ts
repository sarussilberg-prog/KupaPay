import { isRtlLanguage, type Language } from '../i18n/languages';

export type InviteLandingCopy = {
    title: string;
    opening: string;
    openApp: string;
    appStore: string;
    playStore: string;
    footnote: string;
    continueWeb: string;
    installingHint: string;
};

const COPY: Record<Language, InviteLandingCopy> = {
    en: {
        title: 'KupaPay',
        opening: 'Opening the app…',
        openApp: 'Open KupaPay',
        appStore: 'Download on the App Store',
        playStore: 'Get it on Google Play',
        footnote: 'If the app does not open automatically, tap Open KupaPay or install from your store.',
        continueWeb: 'Continue on the web',
        installingHint: 'Taking you to the store to install…',
    },
    he: {
        title: 'KupaPay',
        opening: 'פותח את האפליקציה…',
        openApp: 'פתח את KupaPay',
        appStore: 'הורדה מ‑App Store',
        playStore: 'הורדה מ‑Google Play',
        footnote: 'אם האפליקציה לא נפתחת — לחץ «פתח את KupaPay» או התקן מהחנות.',
        continueWeb: 'המשך בדפדפן',
        installingHint: 'מעביר אותך לחנות להתקנה…',
    },
    ru: {
        title: 'KupaPay',
        opening: 'Открываем приложение…',
        openApp: 'Открыть KupaPay',
        appStore: 'Скачать в App Store',
        playStore: 'Скачать в Google Play',
        footnote: 'Если приложение не открылось — нажмите «Открыть KupaPay» или установите из магазина.',
        continueWeb: 'Продолжить в браузере',
        installingHint: 'Переход в магазин для установки…',
    },
    ar: {
        title: 'KupaPay',
        opening: 'جارٍ فتح التطبيق…',
        openApp: 'افتح KupaPay',
        appStore: 'تنزيل من App Store',
        playStore: 'تنزيل من Google Play',
        footnote: 'إذا لم يُفتح التطبيق تلقائياً، اضغط «افتح KupaPay» أو ثبّت من المتجر.',
        continueWeb: 'المتابعة على الويب',
        installingHint: 'جارٍ نقلك إلى المتجر للتثبيت…',
    },
    fr: {
        title: 'KupaPay',
        opening: 'Ouverture de l’app…',
        openApp: 'Ouvrir KupaPay',
        appStore: 'Télécharger sur l’App Store',
        playStore: 'Disponible sur Google Play',
        footnote: 'Si l’app ne s’ouvre pas, touchez « Ouvrir KupaPay » ou installez depuis le store.',
        continueWeb: 'Continuer sur le web',
        installingHint: 'Redirection vers le store pour installer…',
    },
    es: {
        title: 'KupaPay',
        opening: 'Abriendo la app…',
        openApp: 'Abrir KupaPay',
        appStore: 'Descargar en App Store',
        playStore: 'Disponible en Google Play',
        footnote: 'Si la app no se abre sola, pulsa «Abrir KupaPay» o instala desde la tienda.',
        continueWeb: 'Continuar en la web',
        installingHint: 'Te llevamos a la tienda para instalar…',
    },
    de: {
        title: 'KupaPay',
        opening: 'App wird geöffnet…',
        openApp: 'KupaPay öffnen',
        appStore: 'Im App Store laden',
        playStore: 'Bei Google Play laden',
        footnote: 'Wenn sich die App nicht öffnet, tippe auf «KupaPay öffnen» oder installiere aus dem Store.',
        continueWeb: 'Im Browser fortfahren',
        installingHint: 'Weiterleitung zum Store zur Installation…',
    },
};

export function inviteLandingCopyFor(locale: Language): InviteLandingCopy {
    return COPY[locale];
}

export function inviteLandingDir(locale: Language): 'rtl' | 'ltr' {
    return isRtlLanguage(locale) ? 'rtl' : 'ltr';
}
