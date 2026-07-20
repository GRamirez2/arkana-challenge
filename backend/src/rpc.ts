import Fastify from 'fastify';
import cors from '@fastify/cors';
import { RPCHandler } from '@orpc/server/fastify';
import { onError } from '@orpc/server';
import { router } from './router.js';
import { registerDiabetesRoutes } from './diabetes-routes.js';

// Create one RPC handler bound to your router
const handler = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      console.error('oRPC error:', error);
    }),
  ],
});

// This function *builds* and configures a Fastify app
export const buildApp = () => {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: true,
  });

  // oRPC wants a generic content-type parser here
  app.addContentTypeParser('*', (request, payload, done) => {
    done(null, undefined);
  });

  registerDiabetesRoutes(app);

  // All oRPC routes live under /rpc/*
  app.all('/rpc/*', async (req, reply) => {
    const { matched } = await handler.handle(req, reply, {
      prefix: '/rpc',
      context: {}, // your per-request context, e.g. user, db, etc.
    });

    if (!matched) {
      reply.status(404).send('Not found');
    }
  });

  app.get('/health', async () => ({ ok: true }));

  return app;
};
