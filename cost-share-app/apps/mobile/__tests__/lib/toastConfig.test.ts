import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { toastConfig } from '../../lib/toastConfig';
import { useAppStore } from '../../store';
import type { BaseToastProps } from 'react-native-toast-message';

type ToastType = keyof typeof toastConfig;

function renderToast(type: ToastType, language: 'en' | 'he') {
    useAppStore.setState({ language });
    return render(toastConfig[type]({ text1: 'כותרת', text2: 'פירוט' } as BaseToastProps));
}

// Guards the iOS RTL fix: toast text must render through <AppText> so Hebrew
// right-aligns like the rest of the app. The library's raw <Text> doesn't
// right-align Hebrew on iOS. <AppText> stamps writingDirection onto the text
// style — if a future change swaps back to the library's <Text>, that signal
// disappears and these tests fail.
describe('toastConfig', () => {
    afterEach(() => {
        useAppStore.setState({ language: 'en' });
    });

    it.each(['success', 'error', 'info', 'warning'] as const)(
        'renders %s toast text right-to-left for Hebrew',
        (type) => {
            const { getByText } = renderToast(type, 'he');
            expect(StyleSheet.flatten(getByText('כותרת').props.style).writingDirection).toBe('rtl');
            expect(StyleSheet.flatten(getByText('פירוט').props.style).writingDirection).toBe('rtl');
        },
    );

    it('renders toast text left-to-right for English', () => {
        const { getByText } = renderToast('success', 'en');
        expect(StyleSheet.flatten(getByText('כותרת').props.style).writingDirection).toBe('ltr');
    });
});
