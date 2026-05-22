import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "aahpm",
  name: "American Academy of Hospice & Palliative Medicine",
  kind: "scrape",
  category: "palliative-care",
  base: "https://aahpm.org",
  port: 6417,
  version: "0.1.0",
});

registerTools(server);
server.run();
