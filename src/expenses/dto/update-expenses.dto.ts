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
import { ExpenseTypeDto, SalaryExpenseRoleDto } from './create-expenses.dto';

export class UpdateExpensesDto {
	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	@Min(0.01)
	amount?: number;

	@IsOptional()
	@IsString()
	description?: string;

	@IsOptional()
	@IsEnum(ExpenseTypeDto)
	type?: ExpenseTypeDto;

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
