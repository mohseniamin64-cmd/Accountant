import compression from 'compression';
import express, {
  type ErrorRequestHandler,
  type Express,
} from 'express';
import helmet from 'helmet';
import {errorHandler, notFound} from './common/errors.js';
import {enforceSameOrigin} from './common/origin.js';
import {requestContext} from './common/request-context.js';
import {config} from './config.js';
import {accountingRouter} from './modules/accounting/routes.js';
import {auditRouter} from './modules/audit/routes.js';
import {backupRouter} from './modules/backup/routes.js';
import {populateAuthentication} from './modules/auth/middleware.js';
import {authRouter} from './modules/auth/routes.js';
import {bootstrapRouter} from './modules/bootstrap/routes.js';
import {inventoryRouter} from './modules/inventory/routes.js';
import {organizationRouter} from './modules/organization/routes.js';
import {partiesRouter} from './modules/parties/routes.js';
import {productsRouter} from './modules/products/routes.js';
import {productionRouter} from './modules/production/routes.js';
import {recoveryLaunchRouter} from './recovery/routes.js';
import {
  companyLogoRouter,
  settingsRouter,
} from './modules/settings/routes.js';
import {
  servicePublicRouter,
  serviceRouter,
} from './modules/service/routes.js';
import {setupRouter} from './modules/setup/routes.js';
import {smsGatewayRouter, smsRouter} from './modules/sms/routes.js';
import {purchasesRouter, salesRouter} from './modules/trade/routes.js';
import {treasuryRouter} from './modules/treasury/routes.js';
import {rolesRouter, usersRouter} from './modules/users/routes.js';

export function configureApi(app: Express): void {
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          fontSrc: ["'self'", 'data:'],
          mediaSrc: ["'self'", 'blob:'],
          ...(config.cookieSecure ? {} : {upgradeInsecureRequests: null}),
        },
      },
      crossOriginResourcePolicy: {policy: 'same-origin'},
    }),
  );
  app.use(compression());
  app.use(express.json({limit: '2mb'}));
  app.use(express.urlencoded({extended: false, limit: '2mb'}));
  app.use(requestContext);
  app.use(enforceSameOrigin);
  app.use(populateAuthentication);

  app.use('/api', bootstrapRouter);
  app.use('/api', companyLogoRouter);
  app.use('/api', recoveryLaunchRouter);
  app.use('/api/sms/gateway', smsGatewayRouter);
  app.use('/api/service/public', servicePublicRouter);
  app.use('/api/accounting', accountingRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/backups', backupRouter);
  app.use('/api/setup', setupRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/organization', organizationRouter);
  app.use('/api/parties', partiesRouter);
  app.use('/api/inventory', inventoryRouter);
  app.use('/api/products', productsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/purchases', purchasesRouter);
  app.use('/api/sales', salesRouter);
  app.use('/api/production', productionRouter);
  app.use('/api/service', serviceRouter);
  app.use('/api/treasury', treasuryRouter);
  app.use('/api/sms', smsRouter);
}

export function attachApiNotFound(app: Express): void {
  app.use('/api', notFound);
}

export function attachErrorHandler(app: Express): void {
  app.use(errorHandler as ErrorRequestHandler);
}
