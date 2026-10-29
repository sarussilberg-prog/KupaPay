/** Marketing split-calculator import — return URL after web sign-in (sessionStorage, tab-scoped). */
export const SPLIT_CALCULATOR_POST_LOGIN_RETURN_KEY =
    'kupapay.split_calculator.post_login_return.v1';

export function consumeSplitCalculatorPostLoginReturn(): string | null {
    if (typeof globalThis.sessionStorage === 'undefined') return null;
    const value = globalThis.sessionStorage.getItem(SPLIT_CALCULATOR_POST_LOGIN_RETURN_KEY);
    globalThis.sessionStorage.removeItem(SPLIT_CALCULATOR_POST_LOGIN_RETURN_KEY);
    return value;
}
