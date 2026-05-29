import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "nci",
  name: "NIH NCI",
  kind: "api",
  category: "oncology",
  base: "https://api-evsrest.nci.nih.gov/api/v1",
  port: 6108,
  version: "0.1.0",
});

registerTools(server);
server.run();
