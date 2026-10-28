# Growth experiments (#423)

PostHog feature flags (free tier) drive client-side variants on **iOS, Android, and Expo Web** via the same bundle.

## Flag keys

| Key | Variants | Surface |
|-----|----------|---------|
| `exp-onboarding-template-default` | `control` (trip default), `roommates_first` | Activation onboarding template picker default |
| `exp-paywall-headline` | `control`, `value_focus` | Pro paywall title copy |

Create multivariate flags in PostHog with those variant names. When PostHog is unset, behavior matches `control`.

## Code

| Layer | Path |
|-------|------|
| Flag keys + resolvers | `packages/shared/src/analytics/growthExperiments.ts` |
| PostHog reader | `apps/mobile/lib/growthExperiments.ts` |
| React hook | `apps/mobile/hooks/useGrowthExperiment.ts` |

## Results

Use [EXPERIMENT_RESULTS_TEMPLATE.md](./EXPERIMENT_RESULTS_TEMPLATE.md) when concluding an experiment.
