import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "eugms",
  name: "European Geriatric Medicine Society",
  kind: "scrape",
  category: "geriatrics",
  base: "https://www.eugms.org",
  port: 6415,
  version: "0.1.0",
});

registerTools(server);
server.run();
