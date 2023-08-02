import { createClient, type NormalizeOAS } from "npm:fets";
import type openapi from "./openapi.ts";

export const apiRoot = "https://api.val.town";

export const client = createClient<NormalizeOAS<typeof openapi>>({
  endpoint: apiRoot,
});
