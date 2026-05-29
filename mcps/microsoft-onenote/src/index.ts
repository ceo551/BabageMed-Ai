import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "microsoft-onenote",
  name: "Microsoft OneNote",
  kind: "stub",
  category: "productivity",
  base: "",
  port: 6649,
  version: "0.1.0",
});

registerTools(server);
server.run();
