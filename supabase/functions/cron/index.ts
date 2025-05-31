import { dailyCron, monthlyReset, publicDeadlineReminder } from "./cron.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  let type;
  try {
    const body = await req.json();
    type = body.type;
  } catch {
    return new Response("Bad Request: Invalid JSON", { status: 400 });
  }
  if (type === "daily") {
    return await dailyCron();
  } else if (type === "monthly") {
    return await monthlyReset();
  } else if (type === "public_reminder") {
    return await publicDeadlineReminder();
  }
  return new Response("Invalid cron type", { status: 400 });
}); 