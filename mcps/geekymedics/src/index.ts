import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "geekymedics",
  name: "Geeky Medics",
  kind: "scrape",
  category: "med-ed",
  base: "https://geekymedics.com",
  port: 6520,
  version: "0.1.0",
});

registerTools(server);
server.run();
