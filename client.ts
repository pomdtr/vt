import { createClient, type NormalizeOAS } from "npm:fets";
import openapi from "https://pomdtr-valtownOpenAPI.web.val.run";

export const apiRoot = openapi.servers[0].url;

export const client = createClient<NormalizeOAS<typeof openapi>>({
  endpoint: apiRoot,
});
