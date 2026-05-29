import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "medlineplus",
  name: "MedlinePlus",
  kind: "api",
  category: "patient-ref",
  base: "https://wsearch.nlm.nih.gov",
  port: 6121,
  version: "0.1.0",
});

registerTools(server);
server.run();
