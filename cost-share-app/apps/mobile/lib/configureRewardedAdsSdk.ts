/**
 * Platform entry — Metro resolves `.native.ts` / `.web.ts` at bundle time.
 * This re-export keeps `tsc --noEmit` working for `./configureRewardedAdsSdk` imports.
 */
export { configureRewardedAdsSdk } from './configureRewardedAdsSdk.native';
