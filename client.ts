import { createClient, type NormalizeOAS } from "npm:fets";
import type openapi from "./openapi.ts";

export const valtownToken = Deno.env.get("VALTOWN_TOKEN");
if (!valtownToken) {
  console.error("VALTOWN_TOKEN is not set");
  Deno.exit(1);
}

export const client = createClient<NormalizeOAS<typeof openapi>>({
  endpoint: "https://api.val.town",
});
