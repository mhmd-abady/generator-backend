import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
    CreateExpensesDto,
    ExpenseTypeDto,
    SalaryExpenseRoleDto,
} from './dto/create-expenses.dto';
import { UpdateExpensesDto } from './dto/update-expenses.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class ExpensesService {
    constructor(private readonly prisma: PrismaService) {}

    private async assertSalaryUserMatchesRole(
        userId: number,
        salaryRole: SalaryExpenseRoleDto,
    ) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true },
        });

        if (!user) {
            throw new BadRequestException('Selected salary user was not found');
        }

        const expectedRole =
            salaryRole === SalaryExpenseRoleDto.COLLECTOR
                ? UserRole.COLLECTOR
                : UserRole.EMPLOYEE;

        if (user.role !== expectedRole) {
            throw new BadRequestException(
                `salaryRole ${salaryRole} does not match selected user role ${user.role}`,
            );
        }
    }

    private async toCreateData(dto: CreateExpensesDto) {
        if (dto.type === ExpenseTypeDto.SALARY) {
            if (!dto.salaryRole || !dto.userId) {
                throw new BadRequestException(
                    'salaryRole and userId are required when type is SALARY',
                );
            }

            await this.assertSalaryUserMatchesRole(dto.userId, dto.salaryRole);

            return {
                amount: dto.amount,
                description: dto.description,
                type: dto.type,
                salaryRole: dto.salaryRole,
                userId: dto.userId,
                incurredAt: dto.incurredAt ? new Date(dto.incurredAt) : undefined,
            };
        }

        if (dto.salaryRole || dto.userId) {
            throw new BadRequestException(
                'salaryRole and userId can only be provided when type is SALARY',
            );
        }

        return {
            amount: dto.amount,
            description: dto.description,
            type: dto.type,
            salaryRole: null,
            userId: null,
            incurredAt: dto.incurredAt ? new Date(dto.incurredAt) : undefined,
        };
    }

    private async toUpdateData(existing: any, dto: UpdateExpensesDto) {
        const finalType = dto.type ?? existing.type;

        if (finalType === ExpenseTypeDto.SALARY) {
            const finalSalaryRole = dto.salaryRole ?? existing.salaryRole;
            const finalUserId = dto.userId ?? existing.userId;

            if (!finalSalaryRole || !finalUserId) {
                throw new BadRequestException(
                    'salaryRole and userId are required when type is SALARY',
                );
            }

            await this.assertSalaryUserMatchesRole(finalUserId, finalSalaryRole);

            return {
                amount: dto.amount,
                description: dto.description,
                type: dto.type,
                salaryRole: dto.salaryRole,
                userId: dto.userId,
                incurredAt: dto.incurredAt ? new Date(dto.incurredAt) : undefined,
            };
        }

        if (dto.salaryRole || dto.userId) {
            throw new BadRequestException(
                'salaryRole and userId can only be provided when type is SALARY',
            );
        }

        return {
            amount: dto.amount,
            description: dto.description,
            type: dto.type,
            salaryRole: dto.type ? null : undefined,
            userId: dto.type ? null : undefined,
            incurredAt: dto.incurredAt ? new Date(dto.incurredAt) : undefined,
        };
    }

    async create(dto: CreateExpensesDto) {
        const data = await this.toCreateData(dto);
        return (this.prisma as any).expenses.create({
            data,
            include: {
                user: {
                    select: { id: true, username: true, role: true },
                },
            },
        });
    }

    async update(id: number, dto: UpdateExpensesDto) {
        const existing = await (this.prisma as any).expenses.findUnique({
            where: { id },
            select: {
                id: true,
                type: true,
                salaryRole: true,
                userId: true,
            },
        });

        if (!existing) throw new NotFoundException('Expense not found');

        const data = await this.toUpdateData(existing, dto);

        return (this.prisma as any).expenses.update({
            where: { id },
            data,
            include: {
                user: {
                    select: { id: true, username: true, role: true },
                },
            },
        });
    }

    async list() {
        return (this.prisma as any).expenses.findMany({
            include: {
                user: {
                    select: { id: true, username: true, role: true },
                },
            },
            orderBy: [{ incurredAt: 'desc' }, { id: 'desc' }],
        });
    }

    async delete(id: number) {
        await this.getOne(id);
        return (this.prisma as any).expenses.delete({ where: { id } });
    }

    async getOne(id: number) {
        const expense = await (this.prisma as any).expenses.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, username: true, role: true },
                },
            },
        });

        if (!expense) throw new NotFoundException('Expense not found');
        return expense;
    }
}