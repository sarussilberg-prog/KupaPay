import { Platform } from 'react-native';

/** iOS 26+ liquid-glass style in-app logo (launcher icon still uses icon.png). */
export const IOS_LIQUID_GLASS_MIN_VERSION = 26;

export function shouldUseLiquidGlassAppIcon(): boolean {
    if (Platform.OS !== 'ios') return false;
    const major = typeof Platform.Version === 'string'
        ? parseInt(Platform.Version.split('.')[0] ?? '', 10)
        : Math.floor(Number(Platform.Version));
    return Number.isFinite(major) && major >= IOS_LIQUID_GLASS_MIN_VERSION;
}

export function resolveInAppLogoSource(): number {
    return shouldUseLiquidGlassAppIcon()
        ? require('../assets/icon-glass.png')
        : require('../assets/logo.png');
}
