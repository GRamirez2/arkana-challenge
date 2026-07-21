import Fastify from 'fastify';
import cors from '@fastify/cors';
import { RPCHandler } from '@orpc/server/fastify';
import { onError } from '@orpc/server';
import { router } from './router.js';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
];

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function readAllowedOriginsFromEnv() {
  const raw = process.env.CORS_ORIGINS;
  if (!raw) {
    return DEFAULT_ALLOWED_ORIGINS;
  }

  const values = raw
    .split(',')
    .map((value) => normalizeOrigin(value))
    .filter((value) => value.length > 0);

  return values.length > 0 ? values : DEFAULT_ALLOWED_ORIGINS;
}

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
  const allowedOrigins = new Set(readAllowedOriginsFromEnv());

  app.register(cors, {
    origin: (origin, callback) => {
      // Non-browser clients (curl, server-to-server) usually omit Origin.
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);
      if (allowedOrigins.has(normalizedOrigin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
  });

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
