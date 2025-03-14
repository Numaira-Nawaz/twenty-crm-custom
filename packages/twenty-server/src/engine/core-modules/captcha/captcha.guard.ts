import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

import { CaptchaService } from 'src/engine/core-modules/captcha/captcha.service';
import { HealthCacheService } from 'src/engine/core-modules/health/health-cache.service';

@Injectable()
export class CaptchaGuard implements CanActivate {
  constructor(
    private captchaService: CaptchaService,
    private healthCacheService: HealthCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    console.log('canActivate ------------------------------');
    console.log("context: " + context.getArgs);
    
    const ctx = GqlExecutionContext.create(context);
console.log("ctx: ",ctx);

    const { captchaToken: token } = ctx.getArgs();

    const result = await this.captchaService.validate(token || '');

    if (result.success) {
      return true;
    } else {
      await this.healthCacheService.incrementInvalidCaptchaCounter();

      throw new BadRequestException(
        'Invalid Captcha, please try another device',
      );
    }
  }
}
