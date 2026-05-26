import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "prisma-postgres",
  name: "Prisma Postgres",
  kind: "stub",
  category: "data",
  base: "",
  port: 6727,
  version: "0.1.0",
});

registerTools(server);
server.run();
