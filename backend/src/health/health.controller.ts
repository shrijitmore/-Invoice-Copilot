import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

/**
 * Liveness probe for the hosting platform (Render health checks).
 */
@Controller('health')
export class HealthController {
  /** Returns a simple OK payload with the server time. */
  @Public()
  @Get()
  check(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
