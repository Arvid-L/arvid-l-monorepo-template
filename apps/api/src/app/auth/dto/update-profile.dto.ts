import { UpdateProfileDto as SharedUpdateProfileDto } from '@arvid-l-monorepo-template/shared';
import { IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto implements SharedUpdateProfileDto {
  // Empty string is allowed — it clears the display name.
  @IsString()
  @MaxLength(120)
  displayName!: string;
}
