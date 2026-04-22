import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(["admin", "operator", "viewer"])
  role?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
