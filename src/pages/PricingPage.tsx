import { useEffect } from 'react'

export function PricingPage() {
  useEffect(() => {
    document.body.classList.add('ka-scrollable-page')
    return () => { document.body.classList.remove('ka-scrollable-page') }
  }, [])

  return (
    <div className="ka-pricing-page">
      <button className="ka-legal-back" onClick={() => { window.location.hash = '#/' }}>
        &larr; Back to Kernel
      </button>

      <div className="ka-pricing-hero">
        <h1>Kernel is free</h1>
        <p className="ka-pricing-subtitle">
          10 messages per day. No credit card. No subscriptions.
        </p>
      </div>

      <section className="ka-pricing-section">
        <div className="ka-pricing-cards">
          <div className="ka-pricing-card ka-pricing-card--highlight">
            <div className="ka-pricing-card-header">
              <h3>Free</h3>
              <div className="ka-pricing-card-price">
                $0
              </div>
              <p className="ka-pricing-card-desc">Everything included</p>
            </div>
            <ul className="ka-pricing-card-features">
              <li>10 messages per day</li>
              <li>All specialist agents</li>
              <li>Web search</li>
              <li>Memory</li>
              <li>Conversation history</li>
            </ul>
            <a href="#/" className="ka-pricing-card-cta ka-pricing-card-cta--primary">
              Get started
            </a>
          </div>
        </div>
      </section>

      <div className="ka-pricing-footer">
        <p>Questions? Email <a href="mailto:hello@kernel.chat">hello@kernel.chat</a></p>
      </div>
    </div>
  )
}
