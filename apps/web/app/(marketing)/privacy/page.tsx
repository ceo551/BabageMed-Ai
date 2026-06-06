import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — how we handle your data",
  description:
    "Pervagans Privacy Policy: what information we collect, how we use it, the AI model providers and payment processor we work with, data retention, your privacy rights, security and how to contact us.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy — Pervagans",
    description:
      "How Pervagans collects, uses and protects your data — including AI model providers, Paddle billing, data retention, your GDPR/CCPA-style rights, security and contact details.",
    url: "https://pervagans.com/privacy",
    type: "website",
  },
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://pervagans.com/" },
    { "@type": "ListItem", position: 2, name: "Privacy Policy", item: "https://pervagans.com/privacy" },
  ],
};

export default function PrivacyPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
      />

      {/* Hero */}
      <section className="mkt-section mkt-hero">
        <div className="mkt-wrap">
          <span className="mkt-eyebrow">Legal</span>
          <h1 className="mkt-h1">Privacy Policy</h1>
          <p className="mkt-sub">Last updated: June 2026</p>
        </div>
      </section>

      {/* Policy body */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-legal">
            <h2 className="mkt-h2">Introduction</h2>
            <p>
              This Privacy Policy explains how Pervagans (&ldquo;Pervagans&rdquo;,
              &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;) collects, uses, shares and
              protects your personal information when you use our website at{" "}
              <a href="https://pervagans.com">pervagans.com</a>, our desktop applications and the
              related services (together, the &ldquo;Service&rdquo;). Pervagans is a bilingual
              (English/Arabic) AI assistant and workspace offering multi-model chat, Spaces and
              projects, skills, MCP connectors, AI image and video generation, deep research and an
              Agent Mode.
            </p>
            <p>
              By creating an account or using the Service, you agree to the practices described in
              this policy. If you do not agree, please do not use the Service. Where required by
              law, we rely on a lawful basis such as your consent, the performance of our contract
              with you, our legitimate interests, or compliance with a legal obligation.
            </p>

            <h2 className="mkt-h2">Information we collect</h2>
            <p>We collect the following categories of information:</p>
            <ul>
              <li>
                <strong>Account information.</strong> When you sign up we collect your name, email
                address, authentication details and, for paid plans, the billing information
                handled by our payment processor (see Payments below).
              </li>
              <li>
                <strong>Content you submit.</strong> The prompts, messages, files, images,
                documents, custom instructions, Space and project settings, memory and other
                content you create or upload while using the Service.
              </li>
              <li>
                <strong>Connector data.</strong> If you choose to connect a third-party tool through
                an MCP connector (for example Notion, Slack, GitHub or Google), we process the data
                you authorize the Service to access in order to fulfil your requests. Connectors are
                inert until you connect them, and you can disconnect them at any time.
              </li>
              <li>
                <strong>Usage data.</strong> Information about how you interact with the Service,
                such as features used, credits consumed, models selected, log data, device and
                browser type, approximate location derived from your IP address, timestamps and
                diagnostic information.
              </li>
              <li>
                <strong>Cookies and similar technologies.</strong> We use cookies and similar
                technologies to keep you signed in, remember your preferences, secure the Service
                and understand aggregate usage. You can control cookies through your browser
                settings, though some features may not work without them.
              </li>
            </ul>

            <h2 className="mkt-h2">How we use information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Provide, operate, maintain and improve the Service and its features;</li>
              <li>Generate AI responses, images, video and research outputs in answer to your requests;</li>
              <li>Authenticate users, manage accounts and provide customer support;</li>
              <li>Process subscriptions, credits and billing through our payment processor;</li>
              <li>Monitor, prevent and address fraud, abuse, security and technical issues;</li>
              <li>Understand usage trends and develop new features and improvements;</li>
              <li>Communicate with you about your account, updates and service-related notices; and</li>
              <li>Comply with legal obligations and enforce our terms.</li>
            </ul>

            <h2 className="mkt-h2">AI model providers</h2>
            <p>
              The Service uses leading large language and media models to generate responses. To do
              this, the prompts, messages and related content you submit may be transmitted to and
              processed by third-party AI model providers &mdash; including providers such as
              Anthropic, OpenAI and Google &mdash; solely to generate the output you requested.
              These providers process your content as our service providers and under their own
              terms and privacy commitments.
            </p>
            <p>
              We aim to work with providers that do not use customer content submitted through their
              business APIs to train their foundation models, but the exact handling is governed by
              each provider&rsquo;s terms. Please avoid submitting sensitive personal data,
              regulated data or confidential information you are not authorized to share into any AI
              prompt.
            </p>

            <h2 className="mkt-h2">Payments</h2>
            <p>
              Our order process and billing are conducted by our online reseller and Merchant of
              Record, <a href="https://www.paddle.com" target="_blank" rel="noopener noreferrer">Paddle.com</a>.
              Paddle is the seller of record for purchases made through the Service and handles
              checkout, subscription billing, payment processing and the calculation and collection
              of applicable taxes and VAT.
            </p>
            <p>
              When you make a purchase, your payment details (such as card information) are collected
              and processed directly by Paddle, not by Pervagans &mdash; we do not store your full
              payment card numbers. Paddle&rsquo;s handling of your information is governed by
              Paddle&rsquo;s own privacy policy. We receive limited billing-related information from
              Paddle (such as your plan, transaction status and the country used for tax purposes) so
              that we can manage your subscription and provide support.
            </p>

            <h2 className="mkt-h2">How we share information</h2>
            <p>We do not sell your personal information. We share information only as needed to run the Service:</p>
            <ul>
              <li>
                <strong>Service providers.</strong> With the AI model providers, payment processor,
                cloud hosting, analytics and support vendors who process data on our behalf under
                appropriate confidentiality and data-protection obligations.
              </li>
              <li>
                <strong>At your direction.</strong> With third-party tools you connect through MCP
                connectors, to carry out the actions you request.
              </li>
              <li>
                <strong>Legal and safety.</strong> When required to comply with applicable law, legal
                process or governmental request, or to protect the rights, property or safety of
                Pervagans, our users or others.
              </li>
              <li>
                <strong>Business transfers.</strong> In connection with a merger, acquisition,
                financing or sale of assets, in which case we will require any successor to honor
                this policy.
              </li>
            </ul>

            <h2 className="mkt-h2">Data retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed
              to provide the Service, comply with our legal obligations, resolve disputes and enforce
              our agreements. Content such as your chats, Spaces, files and Gallery is retained while
              your account exists so you can return to it. When you delete content or close your
              account, we delete or anonymize the associated personal data within a reasonable period,
              except where we are required or permitted by law to retain it (for example, billing
              records). Backups are purged on a rolling schedule.
            </p>

            <h2 className="mkt-h2">Your rights</h2>
            <p>
              Depending on where you live, you may have rights under laws such as the EU/UK GDPR and
              the California Consumer Privacy Act (CCPA/CPRA), including the right to:
            </p>
            <ul>
              <li>Access the personal information we hold about you and request a copy;</li>
              <li>Correct inaccurate or incomplete information;</li>
              <li>Delete your personal information;</li>
              <li>Restrict or object to certain processing, and withdraw consent where applicable;</li>
              <li>Request portability of information you provided to us; and</li>
              <li>
                Not receive discriminatory treatment for exercising your rights. We do not sell or
                &ldquo;share&rdquo; personal information for cross-context behavioral advertising.
              </li>
            </ul>
            <p>
              To exercise any of these rights, contact us at{" "}
              <a href="mailto:support@pervagans.com">support@pervagans.com</a>. We will respond within
              the timeframes required by applicable law and may need to verify your identity. You also
              have the right to lodge a complaint with your local data protection authority.
            </p>

            <h2 className="mkt-h2">Security</h2>
            <p>
              We take the security of your data seriously and use technical and organizational
              measures designed to protect it, including encryption in transit, access controls,
              encryption of stored connector credentials and regular review of our systems. No method
              of transmission or storage is completely secure, however, and we cannot guarantee
              absolute security. Please use a strong, unique password and keep your credentials
              confidential.
            </p>

            <h2 className="mkt-h2">Children&rsquo;s privacy</h2>
            <p>
              The Service is not directed to children. It is intended for users aged 16 and older (or
              the minimum age of digital consent in your country, and in no case under 13). We do not
              knowingly collect personal information from children under these ages. If you believe a
              child has provided us with personal information, please contact us and we will take steps
              to delete it.
            </p>

            <h2 className="mkt-h2">International transfers</h2>
            <p>
              Pervagans operates globally and our service providers, including AI model providers and
              our payment processor, may be located in countries other than your own. This means your
              information may be transferred to, stored in and processed in countries whose data
              protection laws differ from those in your jurisdiction. Where required, we put in place
              appropriate safeguards &mdash; such as standard contractual clauses &mdash; to protect
              your information when it is transferred internationally.
            </p>

            <h2 className="mkt-h2">Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices,
              technology, legal requirements or other factors. When we make material changes, we will
              update the &ldquo;Last updated&rdquo; date above and, where appropriate, provide
              additional notice. Your continued use of the Service after an update takes effect
              constitutes acceptance of the revised policy.
            </p>

            <h2 className="mkt-h2">Contact us</h2>
            <p>
              If you have any questions, requests or concerns about this Privacy Policy or how we
              handle your information, please contact us at{" "}
              <a href="mailto:support@pervagans.com">support@pervagans.com</a>. You can also review our{" "}
              <Link href="/about">company information</Link> and{" "}
              <Link href="/pricing">plans and pricing</Link>.
            </p>

            <p>
              <em>
                This Privacy Policy is provided as a general template for informational purposes and
                does not constitute legal advice. It should be reviewed and adapted by qualified legal
                counsel to ensure it accurately reflects your specific practices and complies with all
                applicable laws.
              </em>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
