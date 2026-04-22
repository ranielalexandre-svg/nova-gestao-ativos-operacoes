import { IsEmail, IsIn, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsIn(["admin", "operator", "viewer"])
  role!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
