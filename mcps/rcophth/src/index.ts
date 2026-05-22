import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcophth",
  name: "Royal College of Ophthalmologists",
  kind: "scrape",
  category: "ophthalmology",
  base: "https://www.rcophth.ac.uk",
  port: 6356,
  version: "0.1.0",
});

registerTools(server);
server.run();
