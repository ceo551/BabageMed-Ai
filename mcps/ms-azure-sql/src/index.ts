import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "ms-azure-sql",
  name: "Microsoft Azure SQL Database",
  kind: "stub",
  category: "data",
  base: "",
  port: 6719,
  version: "0.1.0",
});

registerTools(server);
server.run();
