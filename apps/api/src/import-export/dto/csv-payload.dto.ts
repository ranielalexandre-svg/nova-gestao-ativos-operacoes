import { IsString, MaxLength } from "class-validator";

export class CsvPayloadDto {
  @IsString()
  @MaxLength(5_000_000)
  csv!: string;
}
