import '@testing-library/jest-native/extend-expect';

// Mock react-i18next: provide a t() that returns the key so assertions can use keys.
jest.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key,
        i18n: {
            language: 'en',
            changeLanguage: jest.fn(),
            dir: () => 'ltr',
        },
    }),
    initReactI18next: { type: '3rdParty', init: jest.fn() },
    Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock @react-navigation/native hooks used inside screens.
jest.mock('@react-navigation/native', () => {
    const actual = jest.requireActual('@react-navigation/native');
    return {
        ...actual,
        useNavigation: () => ({
            navigate: jest.fn(),
            goBack: jest.fn(),
            push: jest.fn(),
            replace: jest.fn(),
            reset: jest.fn(),
            setOptions: jest.fn(),
            addListener: jest.fn(() => jest.fn()),
        }),
        useRoute: () => ({
            params: {},
            key: 'test',
            name: 'test',
        }),
        useFocusEffect: (cb: () => void) => cb(),
        useIsFocused: () => true,
    };
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock toast
jest.mock('react-native-toast-message', () => ({
    __esModule: true,
    default: {
        show: jest.fn(),
        hide: jest.fn(),
    },
}));

// Silence the React Native logging during tests.
jest.spyOn(console, 'warn').mockImplementation(() => { });
