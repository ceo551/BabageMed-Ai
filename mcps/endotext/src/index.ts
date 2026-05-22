import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "endotext",
  name: "Endotext",
  kind: "api",
  category: "endocrinology",
  base: "https://www.ncbi.nlm.nih.gov/books/NBK279071",
  port: 6129,
  version: "0.1.0",
});

registerTools(server);
server.run();
