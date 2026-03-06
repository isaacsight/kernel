import { useEffect } from 'react'
import { IconCheck, IconCrown, IconZap } from '../components/KernelIcons'

const TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Try Kernel with basic access',
    features: [
      '20 messages per day',
      '5 specialist agents',
      'Web search',
      'File creation',
      'Conversation sharing',
    ],
    cta: 'Get started',
    ctaHref: '#/',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$39',
    period: '/mo',
    annual: '$390/yr',
    description: 'Full power for individuals',
    features: [
      '1,000+ messages/mo, then $0.03/msg',
      'All 17 specialist agents',
      'Extended thinking',
      'Document & image analysis',
      'Voice loop',
      'Agentic workflows',
      'Deep research',
      'Memory & convergence',
      'Project file persistence',
      'Daily briefings',
    ],
    cta: 'Upgrade to Pro',
    ctaHref: '#/',
    highlight: true,
  },
]

const API_TIERS = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    messages: '50',
    rate: '10/min',
    tokens: '100K',
    overage: 'Hard cap',
    agents: '5 core',
    streaming: false,
    swarm: false,
  },
  {
    name: 'Pro',
    price: '$39',
    period: '/mo',
    messages: '1,500',
    rate: '30/min',
    tokens: '3M',
    overage: '$0.03/msg',
    agents: 'All 17',
    streaming: true,
    swarm: false,
  },
  {
    name: 'Growth',
    price: '$249',
    period: '/mo',
    messages: '10,000',
    rate: '120/min',
    tokens: '25M',
    overage: '$0.025/msg',
    agents: 'All 17',
    streaming: true,
    swarm: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    messages: 'Unlimited',
    rate: '180/min',
    tokens: 'Unlimited',
    overage: 'Included',
    agents: 'All 17',
    streaming: true,
    swarm: true,
  },
]

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
        <h1>Pricing</h1>
        <p className="ka-pricing-subtitle">Simple, transparent pricing. No hidden fees.</p>
      </div>

      {/* Web App Plans */}
      <section className="ka-pricing-section">
        <h2 className="ka-pricing-section-title">
          <IconCrown size={16} /> Web App
        </h2>
        <p className="ka-pricing-section-desc">kernel.chat — your personal AI</p>

        <div className="ka-pricing-cards">
          {TIERS.map(tier => (
            <div key={tier.name} className={`ka-pricing-card${tier.highlight ? ' ka-pricing-card--highlight' : ''}`}>
              <div className="ka-pricing-card-header">
                <h3>{tier.name}</h3>
                <div className="ka-pricing-card-price">
                  {tier.price}<span className="ka-pricing-card-period">{tier.period}</span>
                </div>
                {tier.annual && (
                  <div className="ka-pricing-card-annual">or {tier.annual} (save 17%)</div>
                )}
                <p className="ka-pricing-card-desc">{tier.description}</p>
              </div>
              <ul className="ka-pricing-card-features">
                {tier.features.map(f => (
                  <li key={f}><IconCheck size={14} /> {f}</li>
                ))}
              </ul>
              <a href={tier.ctaHref} className={`ka-pricing-card-cta${tier.highlight ? ' ka-pricing-card-cta--primary' : ''}`}>
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* API Plans */}
      <section className="ka-pricing-section">
        <h2 className="ka-pricing-section-title">
          <IconZap size={16} /> API
        </h2>
        <p className="ka-pricing-section-desc">
          Build with Kernel's 17 agents programmatically.{' '}
          <a href="#/api-docs" className="ka-pricing-link">View docs &rarr;</a>
        </p>

        <div className="ka-pricing-table-wrap">
          <table className="ka-pricing-table">
            <thead>
              <tr>
                <th></th>
                {API_TIERS.map(t => (
                  <th key={t.name}>
                    <span className="ka-pricing-table-tier">{t.name}</span>
                    <span className="ka-pricing-table-price">{t.price}<span>{t.period}</span></span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Messages / month</td>
                {API_TIERS.map(t => <td key={t.name}>{t.messages}</td>)}
              </tr>
              <tr>
                <td>Rate limit</td>
                {API_TIERS.map(t => <td key={t.name}>{t.rate}</td>)}
              </tr>
              <tr>
                <td>Token budget</td>
                {API_TIERS.map(t => <td key={t.name}>{t.tokens}</td>)}
              </tr>
              <tr>
                <td>Overage</td>
                {API_TIERS.map(t => <td key={t.name}>{t.overage}</td>)}
              </tr>
              <tr>
                <td>Agents</td>
                {API_TIERS.map(t => <td key={t.name}>{t.agents}</td>)}
              </tr>
              <tr>
                <td>Streaming</td>
                {API_TIERS.map(t => <td key={t.name}>{t.streaming ? <IconCheck size={14} /> : '—'}</td>)}
              </tr>
              <tr>
                <td>Multi-agent swarm</td>
                {API_TIERS.map(t => <td key={t.name}>{t.swarm ? <IconCheck size={14} /> : '—'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ka-pricing-overage-note">
          <strong>How overage works:</strong> Paid plans include a base message quota for both web and API.
          After your quota, each additional message is billed at your plan's overage rate via Stripe metered billing.
          You'll be prompted before overage charges begin on the web. Set a spending ceiling in your dashboard to stay in control.
        </div>
      </section>

      <section className="ka-pricing-section ka-pricing-faq">
        <h2 className="ka-pricing-section-title">FAQ</h2>
        <div className="ka-pricing-faq-grid">
          <div>
            <h4>Can I downgrade?</h4>
            <p>Yes. Go to Account Settings &rarr; Manage Subscription. Changes take effect at the end of your billing cycle.</p>
          </div>
          <div>
            <h4>What happens when I hit my API limit?</h4>
            <p>Free tier: requests are blocked. Paid tiers: overage billing kicks in automatically. Set a spending ceiling to cap costs.</p>
          </div>
          <div>
            <h4>Do web app and API share limits?</h4>
            <p>No. Web app messages and API messages are billed separately.</p>
          </div>
          <div>
            <h4>Can I use my own API key?</h4>
            <p>Yes. K:BOT CLI supports BYOK (Bring Your Own Key) for Anthropic, OpenAI, Google, and 9 other providers. No message limits with BYOK.</p>
          </div>
        </div>
      </section>

      <div className="ka-pricing-footer">
        <p>Questions? Email <a href="mailto:api@kernel.chat">api@kernel.chat</a></p>
      </div>
    </div>
  )
}
