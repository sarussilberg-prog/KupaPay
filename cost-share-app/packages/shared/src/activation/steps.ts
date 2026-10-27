/** Guided activation flow steps (create group → first expense → invite). */
export type ActivationOnboardingStep = 'create' | 'expense' | 'invite';

export const ACTIVATION_ONBOARDING_STEPS: readonly ActivationOnboardingStep[] = [
    'create',
    'expense',
    'invite',
] as const;

export function activationStepIndex(step: ActivationOnboardingStep): number {
    return ACTIVATION_ONBOARDING_STEPS.indexOf(step);
}

export function nextActivationStep(
    step: ActivationOnboardingStep,
): ActivationOnboardingStep | null {
    const idx = activationStepIndex(step);
    if (idx < 0 || idx >= ACTIVATION_ONBOARDING_STEPS.length - 1) return null;
    return ACTIVATION_ONBOARDING_STEPS[idx + 1] ?? null;
}
