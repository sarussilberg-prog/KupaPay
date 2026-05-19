import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './database/supabase.module';
import { AuthModule } from './auth/auth.module';
import { UsersController } from './controllers/users.controller';
import { GroupsController } from './controllers/groups.controller';
import { ExpensesController } from './controllers/expenses.controller';
import { SettlementsController } from './controllers/settlements.controller';
import { UsersService } from './services/users.service';
import { GroupsService } from './services/groups.service';
import { ExpensesService } from './services/expenses.service';
import { CalculationsService } from './services/calculations.service';
import { SettlementsService } from './services/settlements.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        SupabaseModule,
        AuthModule,
    ],
    controllers: [
        UsersController,
        GroupsController,
        ExpensesController,
        SettlementsController,
    ],
    providers: [
        UsersService,
        GroupsService,
        ExpensesService,
        CalculationsService,
        SettlementsService,
    ],
})
export class AppModule {}
