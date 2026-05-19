import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { GroupsService } from '../services/groups.service';
import { CalculationsService } from '../services/calculations.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import {
    ApiResponse,
    Group,
    GroupMember,
    CreateGroupDto,
    UpdateGroupDto,
    GroupSummary,
    UserBalance,
    DebtSummary,
} from '@cost-share/shared';

@Controller('groups')
export class GroupsController {
    constructor(
        private readonly groupsService: GroupsService,
        private readonly calculationsService: CalculationsService,
    ) {}

    @Get()
    async findAll(@CurrentUser() user: AuthUser): Promise<ApiResponse<Group[]>> {
        const groups = await this.groupsService.findAllForUser(user.id);
        return { success: true, data: groups };
    }

    @Get(':id')
    async findById(@Param('id') id: string): Promise<ApiResponse<Group>> {
        const group = await this.groupsService.findById(id);
        if (!group) return { success: false, error: 'Group not found' };
        return { success: true, data: group };
    }

    @Post()
    async create(
        @Body() dto: CreateGroupDto,
        @CurrentUser() user: AuthUser,
    ): Promise<ApiResponse<Group>> {
        const group = await this.groupsService.create(dto, user.id);
        return { success: true, data: group, message: 'Group created successfully' };
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateGroupDto,
    ): Promise<ApiResponse<Group>> {
        const group = await this.groupsService.update(id, dto);
        if (!group) return { success: false, error: 'Group not found' };
        return { success: true, data: group, message: 'Group updated successfully' };
    }

    @Delete(':id')
    async delete(@Param('id') id: string): Promise<ApiResponse<void>> {
        const success = await this.groupsService.delete(id);
        if (!success) return { success: false, error: 'Group not found' };
        return { success: true, message: 'Group deleted successfully' };
    }

    @Get(':id/members')
    async getMembers(@Param('id') id: string): Promise<ApiResponse<GroupMember[]>> {
        const members = await this.groupsService.getMembers(id);
        return { success: true, data: members };
    }

    @Post(':id/members')
    async addMember(
        @Param('id') id: string,
        @Body() dto: { userId: string },
    ): Promise<ApiResponse<GroupMember>> {
        const member = await this.groupsService.addMember({ groupId: id, userId: dto.userId });
        return { success: true, data: member, message: 'Member added successfully' };
    }

    @Delete(':id/members/:userId')
    async removeMember(
        @Param('id') id: string,
        @Param('userId') userId: string,
    ): Promise<ApiResponse<void>> {
        const success = await this.groupsService.removeMember(id, userId);
        if (!success) return { success: false, error: 'Member not found' };
        return { success: true, message: 'Member removed successfully' };
    }

    @Get(':id/balances')
    async getBalances(
        @Param('id') id: string,
        @Query('userId') userId?: string,
    ): Promise<ApiResponse<UserBalance[]>> {
        const balances = await this.calculationsService.calculateUserBalances(id, userId);
        return { success: true, data: balances };
    }

    @Get(':id/debts')
    async getDebts(@Param('id') id: string): Promise<ApiResponse<DebtSummary[]>> {
        const debts = await this.calculationsService.getWhoOwesWhom(id);
        return { success: true, data: debts };
    }

    @Get(':id/summary')
    async getSummary(@Param('id') id: string): Promise<ApiResponse<GroupSummary>> {
        const summary = await this.calculationsService.calculateGroupSummary(id);
        if (!summary) return { success: false, error: 'Group not found' };
        return { success: true, data: summary };
    }
}
