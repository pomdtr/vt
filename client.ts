import { createClient, type NormalizeOAS } from "npm:fets";
import openapi from "./openapi.ts";

export const apiRoot = Deno.env.get("VALTOWN_API") ||
  "https://api.val.town";

export const client = createClient<NormalizeOAS<typeof openapi>>({
  endpoint: apiRoot,
});
