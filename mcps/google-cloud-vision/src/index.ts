import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "google-cloud-vision",
  name:     "Google Cloud Vision",
  kind:     "api",
  category: "ai",
  base:     "",
  port:     6543,
  version:  "0.1.0",
});

registerTools(server);
server.run();
