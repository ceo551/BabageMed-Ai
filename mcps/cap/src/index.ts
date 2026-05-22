import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cap",
  name: "College of American Pathologists",
  kind: "scrape",
  category: "pathology",
  base: "https://www.cap.org",
  port: 6402,
  version: "0.1.0",
});

registerTools(server);
server.run();
