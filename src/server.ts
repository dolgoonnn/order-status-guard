import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { Db } from "./store.js";

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: createApp(new Db()).fetch, port }, () => {
  console.log(`order-status-guard listening on http://localhost:${port}`);
});
