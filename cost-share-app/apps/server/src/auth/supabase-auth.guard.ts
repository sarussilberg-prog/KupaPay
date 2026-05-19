import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthUser } from './auth.types';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
    constructor(private readonly authService: AuthService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<{
            headers: Record<string, string>;
            user?: AuthUser;
        }>();
        const header =
            request.headers?.authorization ?? request.headers?.Authorization;

        if (!header?.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing Bearer token');
        }

        const token = header.slice('Bearer '.length).trim();
        request.user = await this.authService.verifyAccessToken(token);
        return true;
    }
}
