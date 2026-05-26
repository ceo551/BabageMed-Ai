import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mailerlite",
  name: "MailerLite",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6609,
  version: "0.1.0",
});

registerTools(server);
server.run();
