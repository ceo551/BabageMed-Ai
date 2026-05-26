import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "canvas-lms",
  name: "Canvas LMS",
  kind: "stub",
  category: "education",
  base: "",
  port: 6656,
  version: "0.1.0",
});

registerTools(server);
server.run();
