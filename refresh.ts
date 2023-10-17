import yaml from "npm:yaml";
const resp = await fetch("https://www.val.town/docs/openapi.yaml");
const spec = yaml.parse(await resp.text());
console.log(`export default ${JSON.stringify(spec, null, 2)} as const;`);
