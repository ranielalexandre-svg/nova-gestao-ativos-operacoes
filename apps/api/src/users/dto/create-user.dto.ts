import { IsEmail, IsIn, IsString, MinLength } from "class-validator";
import { USER_ROLES } from "../user-roles";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsIn(USER_ROLES)
  role!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
