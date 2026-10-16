import {
    ACTIVATION_TEMPLATE_IDS,
    ACTIVATION_TEMPLATES,
    getActivationTemplate,
    isActivationTemplateId,
} from '../templates';
import {
    ACTIVATION_ONBOARDING_STEPS,
    activationStepIndex,
    nextActivationStep,
} from '../steps';
import { secondsSinceSignup } from '../analytics';

describe('activation templates', () => {
    it('defines four preset templates in stable order', () => {
        expect(ACTIVATION_TEMPLATE_IDS).toEqual(['trip', 'roommates', 'event', 'couple']);
        for (const id of ACTIVATION_TEMPLATE_IDS) {
            expect(getActivationTemplate(id).id).toBe(id);
        }
    });

    it('maps roommates to home group type', () => {
        expect(ACTIVATION_TEMPLATES.roommates.groupType).toBe('home');
    });

    it('guards template id parsing', () => {
        expect(isActivationTemplateId('trip')).toBe(true);
        expect(isActivationTemplateId('general')).toBe(false);
    });
});

describe('activation steps', () => {
    it('orders create → expense → invite', () => {
        expect(ACTIVATION_ONBOARDING_STEPS).toEqual(['create', 'expense', 'invite']);
        expect(activationStepIndex('expense')).toBe(1);
        expect(nextActivationStep('create')).toBe('expense');
        expect(nextActivationStep('invite')).toBeNull();
    });
});

describe('secondsSinceSignup', () => {
    it('returns rounded non-negative seconds', () => {
        expect(secondsSinceSignup(1000, 5500)).toBe(5);
        expect(secondsSinceSignup(9000, 8000)).toBe(0);
    });
});
