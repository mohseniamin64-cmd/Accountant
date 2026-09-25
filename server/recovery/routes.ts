import {Router} from 'express';
import {AppError, asyncRoute} from '../common/errors.js';
import {isLoopbackAddress, launchAdminRecovery} from './launch.js';

export const recoveryLaunchRouter = Router();

recoveryLaunchRouter.post(
  '/recovery/launch',
  asyncRoute(async (request, response) => {
    if (!isLoopbackAddress(request.socket.remoteAddress)) {
      throw new AppError(
        403,
        'LOCAL_ACCESS_REQUIRED',
        'بازیابی مدیر اصلی فقط از روی کامپیوتر سرور قابل اجرا است.',
      );
    }

    await launchAdminRecovery();
    response
      .status(202)
      .set('cache-control', 'no-store')
      .json({data: {launched: true}});
  }),
);
