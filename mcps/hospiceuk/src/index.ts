import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "hospiceuk",
  name: "Hospice UK",
  kind: "scrape",
  category: "palliative-care",
  base: "https://www.hospiceuk.org",
  port: 6419,
  version: "0.1.0",
});

registerTools(server);
server.run();
