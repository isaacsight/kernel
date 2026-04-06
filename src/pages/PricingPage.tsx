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
        <h1>Kernel is free to use</h1>
        <p className="ka-pricing-subtitle">
          Chat 20 times a day. No credit card. No catch.
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
              <p className="ka-pricing-card-desc">Everything you need to get started</p>
            </div>
            <ul className="ka-pricing-card-features">
              <li>20 messages every day</li>
              <li>35 expert AI helpers</li>
              <li>Search the web for answers</li>
              <li>Remembers who you are</li>
              <li>All your chats saved</li>
            </ul>
            <a href="#/" className="ka-pricing-card-cta ka-pricing-card-cta--primary">
              Start chatting for free
            </a>
          </div>
        </div>
      </section>

      <div className="ka-pricing-footer">
        <p>Got questions? Send us an email at <a href="mailto:hello@kernel.chat">hello@kernel.chat</a></p>
      </div>
    </div>
  )
}
