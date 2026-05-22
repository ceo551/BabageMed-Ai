import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "emc-uk",
  name: "Electronic Medicines Compendium (UK)",
  kind: "scrape",
  category: "pharmacology",
  base: "https://www.medicines.org.uk/emc",
  port: 6266,
  version: "0.1.0",
});

registerTools(server);
server.run();
