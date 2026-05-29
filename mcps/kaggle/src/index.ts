import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "kaggle",
  name: "Kaggle",
  kind: "api",
  category: "productivity",
  base: "https://www.kaggle.com/api/v1",
  port: 6174,
  version: "0.1.0",
});

registerTools(server);
server.run();
