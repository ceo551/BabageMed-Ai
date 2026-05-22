import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "healthline",
  name: "Healthline",
  kind: "scrape",
  category: "patient-ref",
  base: "https://www.healthline.com",
  port: 6125,
  version: "0.1.0",
});

registerTools(server);
server.run();
