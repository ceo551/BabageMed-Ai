import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "perplexity-finance",
  name:     "Perplexity Finance",
  kind:     "api",
  category: "finance",
  base:     "",
  port:     6735,
  version:  "0.1.0",
});

registerTools(server);
server.run();
