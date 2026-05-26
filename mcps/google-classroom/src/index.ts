import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id:       "google-classroom",
  name:     "Google Classroom",
  kind:     "api",
  category: "education",
  base:     "",
  port:     6675,
  version:  "0.1.0",
});

registerTools(server);
server.run();
