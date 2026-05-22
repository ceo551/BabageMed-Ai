import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "rcpsych",
  name: "RCPsych",
  kind: "scrape",
  category: "psychiatry",
  base: "https://www.rcpsych.ac.uk",
  port: 6153,
  version: "0.1.0",
});

registerTools(server);
server.run();
