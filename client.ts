import { createClient, type NormalizeOAS } from "npm:fets";
import openapi from "https://pomdtr-valTownSpec.web.val.run/openapi.ts";

export const apiRoot = "https://api.val.town";

export const client = createClient<NormalizeOAS<typeof openapi>>({
  endpoint: apiRoot,
});
