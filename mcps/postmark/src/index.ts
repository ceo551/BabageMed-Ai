import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "postmark",
  name: "Postmark",
  kind: "stub",
  category: "communication",
  base: "",
  port: 6573,
  version: "0.1.0",
});

registerTools(server);
server.run();
