import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "huggingface",
  name: "Hugging Face",
  kind: "api",
  category: "productivity",
  base: "https://huggingface.co/api",
  port: 6182,
  version: "0.1.0",
});

registerTools(server);
server.run();
