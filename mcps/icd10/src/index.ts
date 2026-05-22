import { McpServer } from "@babagemed/mcp-base";
import { registerTools } from "./tools.js";

const server = new McpServer({
  id: "icd10",
  name: "ICD-10",
  kind: "api",
  category: "coding",
  base: "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3",
  port: 6102,
  version: "0.1.0",
});

registerTools(server);
server.run();
