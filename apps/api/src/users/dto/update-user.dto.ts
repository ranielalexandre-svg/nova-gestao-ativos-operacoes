import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import { USER_ROLES } from "../user-roles";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(USER_ROLES)
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
