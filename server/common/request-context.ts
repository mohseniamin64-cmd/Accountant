import {randomUUID} from 'node:crypto';
import type {RequestHandler} from 'express';

export const requestContext: RequestHandler = (request, response, next) => {
  request.requestId = randomUUID();
  request.auth = null;
  request.sessionId = null;
  response.setHeader('X-Request-Id', request.requestId);
  next();
};
