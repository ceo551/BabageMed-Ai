import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service: Pervagans subscription agreement",
  description:
    "The Terms of Service governing your use of Pervagans, the bilingual (English/Arabic) AI assistant and workspace. Covers accounts, subscriptions, billing through Paddle as Merchant of Record, acceptable use, content ownership and liability.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Service: Pervagans subscription agreement",
    description:
      "The terms governing your use of Pervagans: accounts and eligibility, subscriptions billed by Paddle as Merchant of Record, acceptable use, content ownership, AI output disclaimers, liability and more.",
    url: "https://pervagans.com/terms",
    type: "website",
  },
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://pervagans.com/" },
        { "@type": "ListItem", position: 2, name: "Terms of Service", item: "https://pervagans.com/terms" },
      ],
    },
    {
      "@type": "WebPage",
      name: "Terms of Service",
      url: "https://pervagans.com/terms",
      description:
        "The Terms of Service governing use of Pervagans, a bilingual (English/Arabic) AI assistant and workspace sold as a SaaS subscription on web and desktop.",
      isPartOf: { "@type": "WebSite", name: "Pervagans", url: "https://pervagans.com/" },
      publisher: { "@type": "Organization", name: "Pervagans", url: "https://pervagans.com/" },
      dateModified: "2026-06-01",
    },
  ],
};

export default function TermsPage() {
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
          <h1 className="mkt-h1">Terms of Service</h1>
          <p className="mkt-sub">Last updated: June 2026</p>
          <p className="mkt-lede">
            These Terms of Service set out the agreement between you and Pervagans for your use of
            our bilingual AI assistant and workspace. Please read them carefully. By using
            Pervagans you agree to be bound by them.
          </p>
        </div>
      </section>

      {/* Legal body */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-legal">
            <h2 className="mkt-h2">1. Acceptance of these terms</h2>
            <p>
              These Terms of Service (the &ldquo;Terms&rdquo;) form a legally binding agreement
              between you (&ldquo;you&rdquo; or &ldquo;your&rdquo;) and Pervagans
              (&ldquo;Pervagans&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo; or &ldquo;our&rdquo;)
              governing your access to and use of the Pervagans website, applications, and related
              services (together, the &ldquo;Service&rdquo;).
            </p>
            <p>
              By creating an account, subscribing to a plan, or otherwise accessing or using the
              Service, you confirm that you have read, understood, and agree to be bound by these
              Terms and by our{" "}
              <Link href="/privacy">Privacy Policy</Link>, which is incorporated here by reference.
              If you do not agree to these Terms, you must not use the Service. If you are using the
              Service on behalf of an organization, you represent that you are authorized to bind
              that organization to these Terms.
            </p>

            <h2 className="mkt-h2">2. Description of the Service</h2>
            <p>
              Pervagans is a bilingual (English and Arabic) AI assistant and workspace, provided as a
              software-as-a-service subscription on the web and desktop. Depending on your plan, the
              Service may include:
            </p>
            <ul>
              <li>Multi-model chat across leading AI models, including Claude, GPT, Gemini, and more;</li>
              <li>
                Spaces and projects with custom instructions, uploaded files, and persistent memory;
              </li>
              <li>A catalog of expert skills, AI image and video generation, and deep research with citations;</li>
              <li>
                MCP connectors to third-party tools such as Notion, Slack, GitHub, and Google, and an
                Agent Mode that can take multi-step actions on your behalf.
              </li>
            </ul>
            <p>
              The Service is offered with full right-to-left support and is designed to work in both
              English and Arabic. We are continually improving the Service and may add, change, or
              remove features, models, or connectors from time to time.
            </p>

            <h2 className="mkt-h2">3. Accounts and eligibility</h2>
            <p>
              To use most features of the Service you must create an account. You agree to provide
              accurate and complete information and to keep it up to date. You are responsible for
              maintaining the confidentiality of your login credentials and for all activity that
              occurs under your account. Notify us promptly at{" "}
              <a href="mailto:support@pervagans.com">support@pervagans.com</a> if you suspect any
              unauthorized use of your account.
            </p>
            <p>
              You must be at least 18 years old, or the age of majority in your jurisdiction, and
              legally able to enter into a binding contract, to use the Service. You may not use the
              Service if you are barred from doing so under applicable laws, including export-control
              or sanctions regulations.
            </p>

            <h2 className="mkt-h2">4. Subscriptions, billing, and Merchant of Record</h2>
            <p>
              Pervagans is offered on the following plans: a <strong>Free</strong> plan that includes
              500 monthly credits; a <strong>Pro</strong> plan at $20 per month; and a{" "}
              <strong>Max</strong> plan at $60 per month, which includes 200,000 credits. Credits and
              plan features are subject to the limits and fair-use policies described at the point of
              purchase and in your account.
            </p>
            <p>
              Paid subscriptions are sold and processed by{" "}
              <strong>Paddle.com</strong> acting as our <strong>Merchant of Record</strong>. This
              means Paddle is the seller of record for your purchase and is responsible for handling
              checkout, processing payments, billing, and the calculation and collection of
              applicable taxes and VAT. Your purchase is also subject to Paddle&rsquo;s buyer terms
              and policies, which are presented to you during checkout.
            </p>
            <p>
              Unless otherwise stated, paid plans are billed in advance on a recurring basis and{" "}
              <strong>automatically renew</strong> at the then-current price for successive billing
              periods until cancelled. You may cancel your subscription at any time from your account
              settings or via the billing portal provided by Paddle; cancellation takes effect at the
              end of the current billing period, and you retain access to paid features until then. We
              may change our prices or plan features prospectively; any price change will apply to
              billing periods that begin after notice of the change.
            </p>
            <p>
              Refunds, where available, are governed by our{" "}
              <Link href="/refund">Refund Policy</Link> and are administered together with Paddle as
              Merchant of Record. Please review that policy for full details on eligibility and how to
              request a refund.
            </p>

            <h2 className="mkt-h2">5. Acceptable use</h2>
            <p>
              You agree to use the Service lawfully and responsibly. You must not, and must not
              permit anyone else to:
            </p>
            <ul>
              <li>
                Use the Service for any illegal, harmful, fraudulent, or abusive purpose, or in
                violation of any applicable law or regulation;
              </li>
              <li>
                Generate, upload, or distribute content that infringes the intellectual property,
                privacy, or other rights of any third party;
              </li>
              <li>
                Produce or disseminate content that is defamatory, harassing, hateful, or that
                exploits or endangers minors, or that otherwise violates our acceptable use policy;
              </li>
              <li>
                Attempt to reverse engineer, decompile, scrape, overload, disrupt, or circumvent any
                technical or usage limits, security controls, or rate limits of the Service;
              </li>
              <li>
                Use the Service to build or train a competing product, or to resell, sublicense, or
                redistribute the Service or access to it without our prior written consent;
              </li>
              <li>
                Misuse AI outputs to deceive others, impersonate any person or entity, or generate
                spam, malware, or other malicious content.
              </li>
            </ul>
            <p>
              We may suspend or limit access to the Service if we reasonably believe your use
              violates these Terms or creates risk or legal exposure for Pervagans or others.
            </p>

            <h2 className="mkt-h2">6. Your content and ownership</h2>
            <p>
              &ldquo;User Content&rdquo; means the prompts, files, instructions, and other materials
              you submit to the Service, together with the outputs generated for you. As between you
              and Pervagans, <strong>you retain ownership of your User Content</strong> and any rights
              you hold in it. We do not claim ownership of your content.
            </p>
            <p>
              You grant Pervagans a worldwide, non-exclusive, royalty-free license to host, store,
              process, transmit, and display your User Content solely as necessary to operate,
              provide, secure, and improve the Service for you, and to comply with the law. You are
              responsible for your User Content and represent that you have the rights necessary to
              submit it and to grant this license. Our handling of personal data is described in our{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>

            <h2 className="mkt-h2">7. AI output disclaimer</h2>
            <p>
              The Service uses artificial intelligence to generate text, images, video, research
              summaries, and other outputs. AI outputs can be{" "}
              <strong>inaccurate, incomplete, biased, or otherwise unreliable</strong>, and may not
              reflect the most current information. Outputs are provided for your convenience and do
              not constitute professional, legal, medical, financial, or other expert advice.
            </p>
            <p>
              You are responsible for reviewing and independently verifying any output before relying
              on it, and for any decisions or actions you take based on it. This is especially
              important when using Agent Mode or connectors, where the Service may read from or take
              actions in third-party tools on your behalf.
            </p>

            <h2 className="mkt-h2">8. Intellectual property</h2>
            <p>
              The Service, including its software, design, user interface, text, graphics, logos, and
              the &ldquo;Pervagans&rdquo; name and marks, is owned by Pervagans or its licensors and
              is protected by intellectual property and other laws. Subject to your compliance with
              these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license
              to access and use the Service for your own internal or personal purposes.
            </p>
            <p>
              Except as expressly permitted, you may not copy, modify, distribute, sell, or lease any
              part of the Service, nor remove or obscure any proprietary notices. All rights not
              expressly granted to you are reserved by Pervagans.
            </p>

            <h2 className="mkt-h2">9. Third-party services and connectors</h2>
            <p>
              The Service integrates with third-party AI model providers and lets you connect
              third-party tools and connectors, such as Notion, Slack, GitHub, and Google. Your use
              of any third-party service is governed by that provider&rsquo;s own terms and privacy
              practices, and you are responsible for complying with them.
            </p>
            <p>
              When you connect a third-party tool, you authorize the Service to access and exchange
              data with that tool as needed to provide the requested functionality. Pervagans does not
              control, and is not responsible for, the availability, accuracy, or practices of any
              third-party service, and we may modify or discontinue any integration at any time.
            </p>

            <h2 className="mkt-h2">10. Termination</h2>
            <p>
              You may stop using the Service and close your account at any time. We may suspend or
              terminate your access to the Service, in whole or in part, if you breach these Terms, if
              required by law, or if necessary to protect the Service, other users, or third parties.
            </p>
            <p>
              Upon termination, your right to use the Service ends and we may delete your User Content
              in accordance with our data-retention practices. Some sections of these Terms by their
              nature should survive termination. These include ownership, disclaimers, limitation of
              liability, indemnification, and governing law, and they will continue to apply.
            </p>

            <h2 className="mkt-h2">11. Disclaimers and limitation of liability</h2>
            <p>
              The Service is provided <strong>&ldquo;as is&rdquo;</strong> and{" "}
              <strong>&ldquo;as available&rdquo;</strong>, without warranties of any kind, whether
              express, implied, or statutory, including any implied warranties of merchantability,
              fitness for a particular purpose, title, and non-infringement. We do not warrant that
              the Service will be uninterrupted, secure, or error-free, or that any output will be
              accurate or reliable.
            </p>
            <p>
              To the maximum extent permitted by law, Pervagans and its suppliers will not be liable
              for any indirect, incidental, special, consequential, exemplary, or punitive damages, or
              for any loss of profits, revenue, data, goodwill, or other intangible losses, arising out
              of or relating to your use of (or inability to use) the Service. To the maximum extent
              permitted by law, our total aggregate liability for all claims relating to the Service
              will not exceed the greater of the amounts you paid to us (through our Merchant of
              Record) for the Service in the twelve months before the event giving rise to the claim,
              or one hundred US dollars ($100). Some jurisdictions do not allow certain limitations, so
              some of the above may not apply to you.
            </p>

            <h2 className="mkt-h2">12. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless Pervagans and its officers, directors,
              employees, and agents from and against any claims, liabilities, damages, losses, and
              expenses, including reasonable legal fees, arising out of or in any way connected with
              your User Content, your use or misuse of the Service, your violation of these Terms, or
              your violation of any applicable law or the rights of any third party.
            </p>

            <h2 className="mkt-h2">13. Governing law</h2>
            <p>
              These Terms, and any dispute arising out of or relating to them or the Service, are
              governed by the laws applicable to Pervagans&rsquo;s place of business, without regard
              to its conflict-of-laws rules. Where mandatory consumer-protection laws of your country
              of residence grant you additional rights, those rights are not affected by this section.
              Nothing in these Terms affects rights or obligations that apply between you and Paddle as
              Merchant of Record under Paddle&rsquo;s own terms.
            </p>

            <h2 className="mkt-h2">14. Changes to these terms</h2>
            <p>
              We may update these Terms from time to time to reflect changes to the Service, the law,
              or our business. When we make material changes, we will update the &ldquo;Last
              updated&rdquo; date above and, where appropriate, provide additional notice. Your
              continued use of the Service after changes take effect constitutes your acceptance of the
              updated Terms. If you do not agree to the changes, you must stop using the Service.
            </p>

            <h2 className="mkt-h2">15. Contact</h2>
            <p>
              If you have any questions about these Terms or the Service, please contact us at{" "}
              <a href="mailto:support@pervagans.com">support@pervagans.com</a>. You can also review our{" "}
              <Link href="/privacy">Privacy Policy</Link> and{" "}
              <Link href="/refund">Refund Policy</Link>.
            </p>

            <p style={{ marginTop: 32, fontStyle: "italic", opacity: 0.85 }}>
              This document is provided for general informational purposes and is not legal advice.
              Please review it with qualified legal counsel before relying on it for your business.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
