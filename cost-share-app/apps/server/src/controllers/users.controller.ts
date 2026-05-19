import { Controller, Get, Put, Param, Body, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../services/users.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { ApiResponse, User, UpdateProfileDto } from '@cost-share/shared';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Get()
    async findAll(): Promise<ApiResponse<User[]>> {
        const users = await this.usersService.findAll();
        return { success: true, data: users };
    }

    @Get(':id')
    async findById(@Param('id') id: string): Promise<ApiResponse<User>> {
        const user = await this.usersService.findById(id);
        if (!user) return { success: false, error: 'User not found' };
        return { success: true, data: user };
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateProfileDto,
        @CurrentUser() user: AuthUser,
    ): Promise<ApiResponse<User>> {
        if (user.id !== id) {
            throw new ForbiddenException('You can only update your own profile');
        }
        const updated = await this.usersService.update(id, dto);
        if (!updated) return { success: false, error: 'User not found' };
        return { success: true, data: updated };
    }
}
