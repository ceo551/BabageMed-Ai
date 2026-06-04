package mcp

// RemoteTool is one tool exposed by a connected remote MCP server, in a neutral
// shape that both the connectors service (which lists + calls it over the MCP
// JSON-RPC client) and the agent (which presents it to the model) can use
// without importing each other.
type RemoteTool struct {
	ConnectorID string
	Name        string
	Description string
	InputSchema map[string]any
}
