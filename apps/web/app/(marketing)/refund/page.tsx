import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Refund Policy: Subscriptions, billing & cancellations",
  description:
    "Pervagans refund policy: a 14-day good-faith refund window for first-time subscriptions, billed through Paddle as Merchant of Record. How to request a refund, what is non-refundable, and how to cancel.",
  alternates: { canonical: "/refund" },
  openGraph: {
    title: "Refund Policy | Pervagans",
    description:
      "Our fair refund policy for Pervagans subscriptions: a 14-day refund window for first-time purchases, handled by Paddle on our behalf. How to request a refund and how to cancel.",
    url: "https://pervagans.com/refund",
    type: "website",
  },
};

const SCHEMA = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://pervagans.com/" },
    { "@type": "ListItem", position: 2, name: "Refund Policy", item: "https://pervagans.com/refund" },
  ],
};

export default function RefundPolicyPage() {
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
          <h1 className="mkt-h1">Refund Policy</h1>
          <p className="mkt-sub">Last updated: June 2026</p>
        </div>
      </section>

      {/* Legal body */}
      <section className="mkt-section" style={{ paddingTop: 0 }}>
        <div className="mkt-wrap">
          <div className="mkt-legal">
            <h2 className="mkt-h2">Overview</h2>
            <p>
              This Refund Policy explains how refunds and cancellations work for paid
              subscriptions to Pervagans (&ldquo;Pervagans&rdquo;, &ldquo;we&rdquo;,
              &ldquo;us&rdquo; or &ldquo;our&rdquo;), the bilingual English and Arabic AI assistant
              and workspace available on web and desktop. We want you to feel confident trying
              Pervagans, so we keep this policy clear and fair. It forms part of, and should be read
              together with, our{" "}
              <Link href="/terms">Terms of Service</Link>.
            </p>
            <p>
              In short: the Free plan never charges you, paid plans come with a 14-day good-faith
              refund window on your first subscription purchase, you can cancel at any time, and
              refunds are processed for us by Paddle, our payment provider and seller of record.
            </p>

            <h2 className="mkt-h2">The Free plan</h2>
            <p>
              The Pervagans Free plan includes 500 monthly credits and does not require a payment
              method. Because the Free plan never charges you, there is nothing to refund. You can
              use the Free plan for as long as you like, and you can upgrade to a paid plan whenever
              you are ready.
            </p>

            <h2 className="mkt-h2">Subscriptions and billing via Paddle</h2>
            <p>
              Pervagans paid plans are recurring subscriptions:
            </p>
            <ul>
              <li>
                <strong>Pro</strong>: $20 per month.
              </li>
              <li>
                <strong>Max</strong>: $60 per month, including 200,000 credits.
              </li>
            </ul>
            <p>
              Our payments are processed by{" "}
              <a href="https://www.paddle.com" target="_blank" rel="noopener noreferrer">
                Paddle.com
              </a>{" "}
              as the <strong>Merchant of Record</strong>. This means Paddle is the authorized seller
              of record for your purchase and handles checkout, billing, payment methods, and the
              calculation and collection of applicable taxes and VAT. Because Paddle is the merchant
              of record, refunds are issued by Paddle <strong>on our behalf</strong>. We work
              directly with Paddle to review and approve eligible refund requests in line with this
              policy. Your purchase is also subject to{" "}
              <a
                href="https://www.paddle.com/legal/checkout-buyer-terms"
                target="_blank"
                rel="noopener noreferrer"
              >
                Paddle&rsquo;s Buyer Terms
              </a>
              .
            </p>

            <h2 className="mkt-h2">14-day refund window for first-time purchases</h2>
            <p>
              We offer a <strong>14-day refund window</strong> on your first subscription purchase.
              If you are a first-time subscriber to a Pro or Max plan and Pervagans is not the right
              fit for you, contact us within 14 days of that first charge and we will arrange a full
              refund of that initial payment through Paddle. No long forms, no hard sell.
            </p>
            <p>
              Beyond this window, we still aim to be fair. We review every request on a good-faith
              basis and will consider refunds where there is a genuine issue, for example a
              double charge, a clear billing error, or a service problem that prevented you from
              using what you paid for. Where required by the consumer-protection laws of your
              country, you may also have additional statutory rights that this policy does not limit.
            </p>

            <h2 className="mkt-h2">What is non-refundable</h2>
            <p>
              To keep pricing sustainable and fair to everyone, the following are generally not
              refundable:
            </p>
            <ul>
              <li>
                <strong>Consumed credits and usage.</strong> Credits, generations, and other usage
                already spent during a billing period (including AI chat, image and video
                generation, deep research and Agent Mode runs) reflect real compute costs and are
                not refundable.
              </li>
              <li>
                <strong>Partial periods after the refund window.</strong> Once the 14-day window has
                passed, renewal charges and the remaining, unused portion of a current billing
                period are generally not refunded. Instead, your plan continues to work until the
                end of the period you already paid for (see Cancellation below).
              </li>
              <li>
                <strong>Repeat or abusive requests.</strong> We may decline refunds that appear to
                misuse this policy, for example repeatedly subscribing, using a large share of
                credits, and then requesting a refund.
              </li>
            </ul>

            <h2 className="mkt-h2">How to request a refund</h2>
            <p>
              There are two simple ways to request a refund:
            </p>
            <ul>
              <li>
                <strong>Email us</strong> at{" "}
                <a href="mailto:support@pervagans.com">support@pervagans.com</a> from the address on
                your account and tell us briefly what happened.
              </li>
              <li>
                <strong>Use your Paddle receipt.</strong> The payment receipt Paddle emailed you
                includes a link to manage your purchase and contact billing support directly.
              </li>
            </ul>
            <p>
              To help us process your request quickly, please include your{" "}
              <strong>order ID</strong> (shown on your Paddle receipt), the email on your account,
              and the reason for the request. We aim to acknowledge refund requests within a few
              business days. Once a refund is approved, Paddle issues it to your original payment
              method; the time it takes to appear on your statement depends on your bank or card
              provider.
            </p>

            <h2 className="mkt-h2">Cancellation</h2>
            <p>
              You can <strong>cancel at any time</strong> from your account or billing settings.
              When you cancel:
            </p>
            <ul>
              <li>
                Your paid features and credits remain active until the{" "}
                <strong>end of the current billing period</strong> you have already paid for.
              </li>
              <li>
                Your subscription <strong>does not auto-renew</strong> after cancellation, so you
                will not be charged again.
              </li>
              <li>
                At the end of the period, your account moves to the Free plan; your Spaces, files,
                and Gallery remain associated with your account in line with our{" "}
                <Link href="/terms">Terms</Link>.
              </li>
            </ul>
            <p>
              Cancelling stops future renewals but is not by itself a refund. If you also want a
              refund of a recent charge, request one as described above so we can review it under
              this policy.
            </p>

            <h2 className="mkt-h2">Chargebacks</h2>
            <p>
              If you believe you have been charged in error, please contact us first at{" "}
              <a href="mailto:support@pervagans.com">support@pervagans.com</a>. We can almost always
              resolve billing issues faster and more easily than a bank dispute. Filing a chargeback
              or payment dispute with your bank or card provider before contacting us may result in
              your account being suspended while Paddle and your bank investigate. We reserve the
              right to contest chargebacks that conflict with this policy or our{" "}
              <Link href="/terms">Terms of Service</Link>.
            </p>

            <h2 className="mkt-h2">Contact</h2>
            <p>
              Questions about a charge, a refund, or a cancellation? We are happy to help. Email us
              at <a href="mailto:support@pervagans.com">support@pervagans.com</a> and include your
              order ID so we can find your purchase quickly.
            </p>

            <p>
              <em>
                This Refund Policy is provided for general information and should be reviewed with
                qualified legal counsel before you rely on it. Where local consumer-protection laws
                grant you greater rights, those rights apply.
              </em>
            </p>
          </div>

          <div className="mkt-cta-row" style={{ marginTop: 32 }}>
            <Link href="/pricing" className="mkt-btn mkt-btn-primary">
              View pricing
            </Link>
            <Link href="/terms" className="mkt-btn mkt-btn-ghost">
              Read the Terms
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
