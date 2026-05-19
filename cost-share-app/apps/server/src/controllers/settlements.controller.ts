import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { SettlementsService } from '../services/settlements.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import { CreateSettlementDto } from '@cost-share/shared';

@Controller('settlements')
export class SettlementsController {
    constructor(private settlementsService: SettlementsService) {}

    @Get()
    async getSettlements(@Query('groupId') groupId?: string) {
        if (groupId) return this.settlementsService.findByGroup(groupId);
        return this.settlementsService.findAll();
    }

    @Get(':id')
    async getSettlement(@Param('id') id: string) {
        return this.settlementsService.findById(id);
    }

    @Post()
    async createSettlement(
        @Body() dto: CreateSettlementDto,
        @CurrentUser() user: AuthUser,
    ) {
        return this.settlementsService.create(dto, user.id);
    }

    @Get('user/:userId')
    async getUserSettlements(@Param('userId') userId: string) {
        return this.settlementsService.findByUser(userId);
    }

    @Get('history/:groupId/:userId1/:userId2')
    async getSettlementHistory(
        @Param('groupId') groupId: string,
        @Param('userId1') userId1: string,
        @Param('userId2') userId2: string,
    ) {
        return this.settlementsService.getSettlementHistory(groupId, userId1, userId2);
    }
}
