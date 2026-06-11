import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../../users/schemas/user.schema';

export const ROLES_KEY = 'roles';

/**
 * Restricts a route to the given roles. Must be combined with
 * {@link RolesGuard} (registered globally).
 *
 * @param roles - Roles allowed to access the route.
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
