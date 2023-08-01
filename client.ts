import { createClient, type NormalizeOAS } from "npm:fets";
import type openapi from "./openapi.ts";

export const VALTOWN_TOKEN_ENV = "VALTOWN_TOKEN";

export const client = createClient<NormalizeOAS<typeof openapi>>({
  endpoint: "https://api.val.town",
});
