import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpensesDto } from './dto/create-expenses.dto';
import { UpdateExpensesDto } from './dto/update-expenses.dto';
import { Roles } from '../auth/roles/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('expenses')
export class ExpensesController {
    constructor(private readonly expensesService: ExpensesService) {}

    @Post()
    @Roles(UserRole.ADMIN)
    create(@Body() dto: CreateExpensesDto) {
        return this.expensesService.create(dto);
    }

    @Get()
    findAll() {
        return this.expensesService.list();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.expensesService.getOne(id);
    }

    @Patch(':id')
    @Roles(UserRole.ADMIN)
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateExpensesDto,
    ) {
        return this.expensesService.update(id, dto);
    }

    @Delete(':id')
    @Roles(UserRole.ADMIN)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.expensesService.delete(id);
    }
}