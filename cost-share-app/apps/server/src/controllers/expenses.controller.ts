import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ExpensesService } from '../services/expenses.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { AuthUser } from '../auth/auth.types';
import {
    ApiResponse,
    Expense,
    ExpenseSplit,
    CreateExpenseDto,
    UpdateExpenseDto,
} from '@cost-share/shared';

@Controller('expenses')
export class ExpensesController {
    constructor(private readonly expensesService: ExpensesService) {}

    @Get()
    async findAll(@Query('groupId') groupId?: string): Promise<ApiResponse<Expense[]>> {
        const expenses = groupId
            ? await this.expensesService.findByGroupId(groupId)
            : await this.expensesService.findAll();
        return { success: true, data: expenses };
    }

    @Get(':id')
    async findById(@Param('id') id: string): Promise<ApiResponse<Expense>> {
        const expense = await this.expensesService.findById(id);
        if (!expense) return { success: false, error: 'Expense not found' };
        return { success: true, data: expense };
    }

    @Post()
    async create(
        @Body() dto: CreateExpenseDto,
        @CurrentUser() user: AuthUser,
    ): Promise<ApiResponse<Expense> | ApiResponse<never>> {
        const createdBy = user.id;
        const result = await this.expensesService.create(dto, createdBy);
        if ('error' in result) return { success: false, error: result.error };
        return { success: true, data: result, message: 'Expense created successfully' };
    }

    @Put(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateExpenseDto,
    ): Promise<ApiResponse<Expense> | ApiResponse<never>> {
        const result = await this.expensesService.update(id, dto);
        if (!result) return { success: false, error: 'Expense not found' };
        if ('error' in result) return { success: false, error: result.error };
        return { success: true, data: result, message: 'Expense updated successfully' };
    }

    @Delete(':id')
    async delete(@Param('id') id: string): Promise<ApiResponse<void>> {
        const success = await this.expensesService.delete(id);
        if (!success) return { success: false, error: 'Expense not found' };
        return { success: true, message: 'Expense deleted successfully' };
    }

    @Get(':id/splits')
    async getSplits(@Param('id') id: string): Promise<ApiResponse<ExpenseSplit[]>> {
        const splits = await this.expensesService.getSplits(id);
        return { success: true, data: splits };
    }

    @Get(':id/with-splits')
    async getExpenseWithSplits(
        @Param('id') id: string,
    ): Promise<ApiResponse<{ expense: Expense; splits: ExpenseSplit[] }>> {
        const result = await this.expensesService.getExpenseWithSplits(id);
        if (!result) return { success: false, error: 'Expense not found' };
        return { success: true, data: result };
    }
}
