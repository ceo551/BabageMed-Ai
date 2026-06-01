import { McpServer } from "@pervagans/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "gdrive",
  name: "Google Drive",
  kind: "api",
  category: "productivity",
  base: "https://www.googleapis.com/drive/v3",
  port: 6183,
  version: "0.1.0",
});

registerTools(server);
server.run();
