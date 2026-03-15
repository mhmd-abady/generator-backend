import { Type } from 'class-transformer';
import {
	IsDateString,
	IsDefined,
	IsEnum,
	IsInt,
	IsNumber,
	IsOptional,
	IsString,
	Min,
	ValidateIf,
} from 'class-validator';

export enum ExpenseTypeDto {
	OIL = 'OIL',
	MAINTENANCE = 'MAINTENANCE',
	SALARY = 'SALARY',
	OTHER = 'OTHER',
}

export enum SalaryExpenseRoleDto {
	COLLECTOR = 'COLLECTOR',
	EMPLOYEE = 'EMPLOYEE',
}

export class CreateExpensesDto {
	@Type(() => Number)
	@IsNumber()
	@Min(0.01)
	amount: number;

	@IsString()
	description: string;

	@IsEnum(ExpenseTypeDto)
	type: ExpenseTypeDto;

	@ValidateIf((o) => o.type === ExpenseTypeDto.SALARY)
	@IsDefined({ message: 'salaryRole is required when type is SALARY' })
	@IsEnum(SalaryExpenseRoleDto)
	salaryRole?: SalaryExpenseRoleDto;

	@ValidateIf((o) => o.type === ExpenseTypeDto.SALARY)
	@IsDefined({ message: 'userId is required when type is SALARY' })
	@Type(() => Number)
	@IsInt()
	userId?: number;

	@IsOptional()
	@IsDateString()
	incurredAt?: string;
}