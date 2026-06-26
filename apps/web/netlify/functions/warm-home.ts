import { schedule } from "@netlify/functions";
import { warmHome } from "../../lib/warmHome";

export const handler = schedule("*/5 * * * *", async () => {
  try {
    await warmHome();
  } catch (err) {
    console.error("warm-home:", err);
    return { statusCode: 500 };
  }

  return { statusCode: 200 };
});
