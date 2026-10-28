import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAuthRouteGate } from '../lib/authRouteGate';

test('resolveAuthRouteGate allows auth callback without a session', () => {
    assert.deepEqual(resolveAuthRouteGate('/auth/callback', false), { kind: 'allow' });
});

test('resolveAuthRouteGate sends anonymous users on protected paths to login with return path', () => {
    assert.deepEqual(resolveAuthRouteGate('/home', false), {
        kind: 'redirect_to_login',
        loginPath: '/login',
        returnPath: '/home',
    });
});

test('resolveAuthRouteGate bounces authenticated users away from /login', () => {
    assert.deepEqual(resolveAuthRouteGate('/login', true), {
        kind: 'redirect_authenticated_from_login',
        destinationPath: '/',
    });
});
