import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcsed",
  name: "Royal College of Surgeons of Edinburgh",
  kind: "scrape",
  category: "surgery",
  base: "https://www.rcsed.ac.uk",
  port: 6283,
  version: "0.1.0",
});

registerTools(server);
server.run();
