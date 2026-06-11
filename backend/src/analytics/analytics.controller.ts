import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AnalyticsService, DashboardAnalytics } from './analytics.service';

/**
 * Dashboard analytics API.
 */
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /** Returns every dashboard metric and chart series in one payload. */
  @Get('dashboard')
  dashboard(@CurrentUser() user: AuthenticatedUser): Promise<DashboardAnalytics> {
    return this.analyticsService.dashboard(user.userId);
  }
}
