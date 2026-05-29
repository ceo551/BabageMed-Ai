import { McpServer } from "@babbage/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "mailchimp",
  name: "Mailchimp",
  kind: "stub",
  category: "marketing",
  base: "",
  port: 6738,
  version: "0.1.0",
});

registerTools(server);
server.run();
