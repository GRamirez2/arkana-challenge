// src/router.ts
import { os } from "@orpc/server";

const ping = os.handler(async () => "pong");

export const router = {
  ping,
};