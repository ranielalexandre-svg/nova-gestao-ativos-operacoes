import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";

export class CreateExceptionCommentDto {
  @IsString()
  @MinLength(2)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
