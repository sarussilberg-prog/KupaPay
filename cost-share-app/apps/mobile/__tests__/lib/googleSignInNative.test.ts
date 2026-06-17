import { Platform } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  configureNativeGoogleSignIn,
  isNativeGoogleSignInEnabled,
  signInWithGoogleNative,
} from '../../lib/googleSignInNative';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
  isErrorWithCode: () => false,
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

function setPlatformOs(os: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

describe('googleSignInNative', () => {
  const prevWeb = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const prevIos = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  beforeAll(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client-id';
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-client-id';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = prevWeb;
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = prevIos;
  });

  describe('configureNativeGoogleSignIn', () => {
    it('configures the iOS and web client IDs on iOS', () => {
      setPlatformOs('ios');
      configureNativeGoogleSignIn();
      expect(GoogleSignin.configure).toHaveBeenCalledWith({
        iosClientId: 'ios-client-id',
        webClientId: 'web-client-id',
        offlineAccess: false,
      });
    });

    it('configures only the web client ID on Android', () => {
      setPlatformOs('android');
      configureNativeGoogleSignIn();
      expect(GoogleSignin.configure).toHaveBeenCalledWith({
        webClientId: 'web-client-id',
        offlineAccess: false,
      });
    });

    it('does not configure on iOS when the iOS client ID is missing', () => {
      setPlatformOs('ios');
      delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      configureNativeGoogleSignIn();
      expect(GoogleSignin.configure).not.toHaveBeenCalled();
    });
  });

  describe('isNativeGoogleSignInEnabled', () => {
    it('is true on iOS when the iOS client ID is set', () => {
      setPlatformOs('ios');
      expect(isNativeGoogleSignInEnabled()).toBe(true);
    });

    it('is false on iOS without an iOS client ID', () => {
      setPlatformOs('ios');
      delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
      expect(isNativeGoogleSignInEnabled()).toBe(false);
    });

    it('is false on web', () => {
      setPlatformOs('web');
      expect(isNativeGoogleSignInEnabled()).toBe(false);
    });
  });

  describe('signInWithGoogleNative', () => {
    it('returns a success result with the id token', async () => {
      setPlatformOs('ios');
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        type: 'success',
        data: { idToken: 'tok' },
      });
      const result = await signInWithGoogleNative();
      expect(result).toEqual({ type: 'success', idToken: 'tok' });
    });

    it('returns a cancelled result when the user dismisses the picker', async () => {
      setPlatformOs('ios');
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({ type: 'cancelled', data: null });
      const result = await signInWithGoogleNative();
      expect(result).toEqual({ type: 'cancelled' });
    });

    it('returns an error result when no id token is returned', async () => {
      setPlatformOs('ios');
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        type: 'success',
        data: { idToken: null },
      });
      const result = await signInWithGoogleNative();
      expect(result.type).toBe('error');
    });
  });
});
