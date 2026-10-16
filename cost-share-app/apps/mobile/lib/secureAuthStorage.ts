/**
 * Platform entry — Metro resolves `.native.ts` / `.web.ts` at bundle time.
 * This re-export keeps `tsc --noEmit` working for `./secureAuthStorage` imports.
 */
export {
    secureAuthGetItem,
    secureAuthRemoveItem,
    secureAuthSetItem,
} from './secureAuthStorage.native';
