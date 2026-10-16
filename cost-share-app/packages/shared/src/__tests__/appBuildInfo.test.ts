import {
    formatAppBuildInfoLines,
    normalizeDeployEnvironment,
    resolveAppBuildInfo,
} from '../appBuildInfo';

describe('appBuildInfo', () => {
    it('normalizes environment labels', () => {
        expect(normalizeDeployEnvironment('production')).toBe('prod');
        expect(normalizeDeployEnvironment('development')).toBe('dev');
    });

    it('formats settings footer lines', () => {
        const info = resolveAppBuildInfo({
            version: '2.2.0-dev.2',
            buildNumber: '42',
            commitSha: 'abcdef1234567890',
            environment: 'dev',
        });
        expect(formatAppBuildInfoLines(info)).toEqual([
            'Version 2.2.0-dev.2',
            'Build 42',
            'Commit abcdef1',
            'Environment dev',
        ]);
    });
});
