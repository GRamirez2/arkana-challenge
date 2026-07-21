import { buildApp } from "./rpc.js";

const start = async () => {
  const app = buildApp();

  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
    app.log.info("Server running on http://0.0.0.0:3000");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();