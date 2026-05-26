import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "cloudinary",
  name: "Cloudinary",
  kind: "stub",
  category: "creative",
  base: "",
  port: 6697,
  version: "0.1.0",
});

registerTools(server);
server.run();
