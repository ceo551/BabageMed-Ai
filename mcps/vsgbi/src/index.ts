import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "vsgbi",
  name: "Vascular Society of Great Britain & Ireland",
  kind: "scrape",
  category: "vascular-surgery",
  base: "https://www.vascularsociety.org.uk",
  port: 6217,
  version: "0.1.0",
});

registerTools(server);
server.run();
