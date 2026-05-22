import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "snacc",
  name: "Society for Neuroscience in Anesthesiology & Critical Care",
  kind: "scrape",
  category: "anesthesia",
  base: "https://snacc.org",
  port: 6302,
  version: "0.1.0",
});

registerTools(server);
server.run();
