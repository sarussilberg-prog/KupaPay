import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SupabaseAuthGuard } from '../supabase-auth.guard';
import { AuthService } from '../auth.service';

describe('SupabaseAuthGuard', () => {
    const authService = {
        verifyAccessToken: jest.fn(),
    } as unknown as AuthService;

    const guard = new SupabaseAuthGuard(authService);

    const buildContext = (authorization?: string): ExecutionContext => {
        const request: { headers: Record<string, string>; user?: unknown } = {
            headers: authorization ? { authorization } : {},
        };
        return {
            switchToHttp: () => ({
                getRequest: () => request,
            }),
        } as ExecutionContext;
    };

    it('rejects requests without Bearer token', async () => {
        await expect(guard.canActivate(buildContext())).rejects.toBeInstanceOf(
            UnauthorizedException,
        );
    });

    it('accepts valid token and sets request.user', async () => {
        (authService.verifyAccessToken as jest.Mock).mockResolvedValue({
            id: 'user-uuid-1',
            email: 'a@example.com',
        });

        const ctx = buildContext('Bearer valid-token');
        const req = ctx.switchToHttp().getRequest();

        await expect(guard.canActivate(ctx)).resolves.toBe(true);
        expect(req.user).toEqual({ id: 'user-uuid-1', email: 'a@example.com' });
        expect(authService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    });
});
