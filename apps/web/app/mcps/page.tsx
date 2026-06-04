"use client";

import Link from "next/link";
import { useUI } from "../lib/ui-context";
import { RemoteMcpSection } from "./RemoteMcpSection";
import "./mcps.css";

// Connectors directory — Claude-style remote MCP servers. Click Connect → sign
// in at the provider → connected, with zero operator setup. The earlier
// self-hosted connector grid (shared-token pods) was retired in favour of these
// hosted MCP servers; connected servers' tools are available to the assistant
// in Agent Mode.
export default function ConnectorsBrowsePage() {
  const { locale } = useUI();
  const ar = locale === "ar";
  return (
    <div className="mcps-shell">
      <Link href="/" style={{ color: "var(--cyan)", fontSize: 13 }}>← {ar ? "الرئيسية" : "Dashboard"}</Link>
      <h1>{ar ? "الموصِّلات" : "Connectors"}</h1>
      <p className="lead">
        {ar
          ? "اربط أي خادم MCP خارجي بضغطة واحدة — بتسجّل دخول عند المزوّد، من غير أي إعداد، زي Claude. والموصّلات المتصلة بيقدر المساعد يستخدم أدواتها في وضع Agent."
          : "Connect any external MCP server in one click — sign in at the provider, no setup, just like Claude. Connected servers' tools are available to the assistant in Agent Mode."}
      </p>
      <RemoteMcpSection />
    </div>
  );
}
