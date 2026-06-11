import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from './schemas/user.schema';
import { UserProfile, UsersService } from './users.service';

/**
 * Admin-only endpoints, protected by the global {@link RolesGuard}.
 */
@Roles(UserRole.Admin)
@Controller('admin')
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  /** Lists all registered users. */
  @Get('users')
  listUsers(): Promise<UserProfile[]> {
    return this.usersService.listUsers();
  }

  /** Platform-wide usage counters. */
  @Get('stats')
  stats(): Promise<{ users: number; invoices: number; chatSessions: number }> {
    return this.usersService.platformStats();
  }
}
