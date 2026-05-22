import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "sages",
  name: "Society of American GI & Endoscopic Surgeons",
  kind: "scrape",
  category: "surgery",
  base: "https://www.sages.org",
  port: 6286,
  version: "0.1.0",
});

registerTools(server);
server.run();
