import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "skintherapyletter",
  name: "Skin Therapy Letter",
  kind: "scrape",
  category: "dermatology",
  base: "https://www.skintherapyletter.com",
  port: 6350,
  version: "0.1.0",
});

registerTools(server);
server.run();
