import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "insightsimaging",
  name: "Insights into Imaging",
  kind: "scrape",
  category: "radiology",
  base: "https://insightsimaging.springeropen.com",
  port: 6264,
  version: "0.1.0",
});

registerTools(server);
server.run();
