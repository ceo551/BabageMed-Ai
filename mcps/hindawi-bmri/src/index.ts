import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "hindawi-bmri",
  name: "Hindawi BioMed Research International",
  kind: "scrape",
  category: "oa-journal",
  base: "https://www.hindawi.com/journals/bmri/",
  port: 6504,
  version: "0.1.0",
});

registerTools(server);
server.run();
