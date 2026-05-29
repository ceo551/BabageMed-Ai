import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "clinicaltrials",
  name: "ClinicalTrials.gov",
  kind: "api",
  category: "trials",
  base: "https://clinicaltrials.gov/api/v2",
  port: 6116,
  version: "0.1.0",
});

registerTools(server);
server.run();
