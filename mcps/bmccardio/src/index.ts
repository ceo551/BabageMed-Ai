import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "bmccardio",
  name: "BMC Cardiovascular Disorders",
  kind: "scrape",
  category: "oa-journal",
  base: "https://bmccardiovascdisord.biomedcentral.com",
  port: 6484,
  version: "0.1.0",
});

registerTools(server);
server.run();
