import {
  UpdateUserRoleDto as SharedUpdateUserRoleDto,
  UserRole,
} from '@arvid-l-monorepo-template/shared';
import { IsEnum } from 'class-validator';

export class UpdateUserRoleDto implements SharedUpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
