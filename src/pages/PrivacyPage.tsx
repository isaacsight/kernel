export function PrivacyPage() {
  return (
    <div className="ka-legal-page">
      <button className="ka-legal-back" onClick={() => { window.location.hash = '#/' }}>
        &larr; Back to Kernel
      </button>

      <h1>Privacy Policy</h1>
      <p className="ka-legal-updated">Last updated: February 26, 2026</p>

      <p>
        Kernel is a personal AI built by Isaac Hernandez. This policy explains what we collect,
        how we use it, and what makes our approach different from most AI platforms.
        We wrote this in plain language because you deserve to understand it.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>Account Information</h3>
      <p>
        When you create an account, we collect your email address and any profile information you
        choose to provide (display name, username, avatar image). If you sign in through Google,
        GitHub, or X (Twitter), we receive the basic profile information those providers share:
        your name, email, and profile picture.
      </p>

      <h3>Conversations</h3>
      <p>
        We store the full text of your messages and Kernel's responses. Each message is associated
        with your user account and organized into conversations. This data is the foundation of
        Kernel's ability to remember you across sessions. Conversations are private to your
        account and never visible to other users unless you explicitly share them using the share
        feature, which generates a read-only public link.
      </p>

      <h3>Uploaded Files</h3>
      <p>
        When you attach files to a conversation (images, PDFs, text files, audio), those files
        are processed to generate responses. Images and PDFs are sent to the AI model as part of
        the conversation. Audio files are transcribed. Text files are read and included as context.
        Avatar images are stored in our file storage system.
      </p>

      <h3>User Memory Profile</h3>
      <p>
        Every few messages, Kernel automatically extracts a structured profile from your
        conversations. This profile includes: your interests, goals you've mentioned,
        facts you've shared about yourself, your communication style, and your stated preferences.
        This extraction is performed by an AI model and stored in our database. It is used to
        personalize future responses.
      </p>

      <h3>Knowledge Graph</h3>
      <p>
        Kernel builds a knowledge graph &mdash; a structured map of people, projects, concepts,
        and relationships you mention across conversations. For example, if you mention a coworker
        named Alex who works on a project called Atlas, Kernel may store that relationship. This
        graph is used to provide continuity and context across conversations.
      </p>

      <h3>Goals and Briefings</h3>
      <p>
        If you set goals through Kernel, we store them along with progress notes and milestones.
        Daily briefings are generated and stored based on your interests and goals.
      </p>

      <h3>Usage Data</h3>
      <p>
        We log message counts, which specialist agents handle your messages, response quality
        signals, and timestamps. This data is used for rate limiting, abuse prevention, and to
        improve routing accuracy. We also maintain audit logs of edge function calls for security
        purposes, which are automatically purged after 90 days.
      </p>

      <h3>Payment Information</h3>
      <p>
        If you subscribe to Kernel Pro, payment processing is handled entirely by Stripe. We do
        not store your credit card number, bank account, or other payment credentials. We receive
        your subscription status, customer ID, and billing email from Stripe.
      </p>

      <h2>2. The Mirror: Multi-Agent Perception</h2>

      <p>
        This section describes a capability that is unique to Kernel. We believe in being
        transparent about it because it goes beyond what most AI platforms do with your data.
      </p>

      <p>
        Kernel uses multiple specialist agents &mdash; Researcher, Coder, Writer, Analyst, and
        others &mdash; to respond to your messages. Each agent is designed to see your conversations
        from a different angle. We call these angles <strong>facets</strong>, and together they form
        what we call <strong>the Mirror</strong>.
      </p>

      <p>The six perception facets are:</p>

      <ul>
        <li><strong>Relationship</strong> &mdash; how you engage with Kernel, what builds trust, what creates friction, your emotional patterns in conversation</li>
        <li><strong>Curiosity</strong> &mdash; what topics draw you in, whether you prefer breadth or depth, what domains you return to repeatedly</li>
        <li><strong>Craft</strong> &mdash; how you approach problem-solving, your technical skill level, whether you work methodically or intuitively</li>
        <li><strong>Voice</strong> &mdash; how you express yourself, your writing style, whether you think in metaphors or lists or narratives</li>
        <li><strong>Judgment</strong> &mdash; how you make decisions, your risk tolerance, whether you seek validation or challenge</li>
        <li><strong>Arc</strong> &mdash; how you are changing over time, what interests have faded, what is emerging, your trajectory</li>
      </ul>

      <p>
        After every few conversations, the active agent extracts observations through its facet
        lens. Periodically, a process called <strong>Convergence</strong> synthesizes observations
        across all facets to produce emergent insights &mdash; patterns about you that require
        multiple perspectives to see.
      </p>

      <p>
        For example, the Convergence might notice that your writing becomes more precise when
        you are excited about a project (combining the Voice and Relationship facets), or that
        your research patterns suggest you are transitioning from exploring a field to building
        within it (combining Curiosity and Arc).
      </p>

      <p><strong>What we do with Mirror data:</strong></p>
      <ul>
        <li>Facets and convergence insights are stored in our database, associated with your account</li>
        <li>They are injected into Kernel's context to improve future conversations with you</li>
        <li>They are never shared with other users</li>
        <li>They are never used for advertising, profiling for third parties, or any purpose other than improving your experience with Kernel</li>
        <li>They are deleted when you delete your account or reset your memory</li>
      </ul>

      <h2>3. How We Use Your Information</h2>

      <ul>
        <li><strong>Core service:</strong> Generating personalized AI responses to your messages</li>
        <li><strong>Memory:</strong> Building and maintaining your user profile, knowledge graph, and perception facets so Kernel improves over time</li>
        <li><strong>Goals and briefings:</strong> Tracking goals you set and generating daily briefings tailored to your interests</li>
        <li><strong>Payments:</strong> Processing Pro subscriptions through Stripe</li>
        <li><strong>Security:</strong> Rate limiting, audit logging, and abuse prevention</li>
        <li><strong>Service improvement:</strong> Understanding aggregate usage patterns to improve Kernel (we do not use individual conversations for this)</li>
      </ul>

      <h2>4. Automated Decision-Making</h2>

      <p>
        Kernel uses automated systems to process your messages. In the interest of transparency,
        here is how automated decisions affect your experience:
      </p>

      <ul>
        <li><strong>Agent routing:</strong> An AI classifier automatically determines which specialist agent (Researcher, Coder, Writer, etc.) should handle each message. This is based on message content, not personal characteristics.</li>
        <li><strong>Rate limiting:</strong> Automated systems enforce message limits for free-tier users (20 per 24 hours). This is applied uniformly to all free accounts.</li>
        <li><strong>Memory extraction:</strong> An AI model periodically extracts profile data from your conversations to build your memory profile. This is used solely for personalization.</li>
        <li><strong>Convergence synthesis:</strong> Multi-agent perception data is synthesized automatically to generate insights about your patterns and preferences.</li>
      </ul>

      <p>
        None of these automated processes make decisions that have legal or similarly significant
        effects on you. They affect only the quality and personalization of AI responses within
        the service. If you believe an automated decision has negatively affected you, contact us
        to request human review.
      </p>

      <h2>5. What We Do Not Do</h2>

      <ul>
        <li>We <strong>do not sell</strong> your personal data to anyone, for any reason</li>
        <li>We <strong>do not use</strong> your conversations to train or fine-tune AI models</li>
        <li>We <strong>do not share</strong> your data with advertisers or data brokers</li>
        <li>We <strong>do not share</strong> your perception facets, convergence insights, or memory profile with any third party</li>
        <li>We <strong>do not allow</strong> other users to access your profile, memory, conversations, or any derived data</li>
        <li>We <strong>do not track</strong> you across other websites or apps</li>
        <li>We <strong>do not use</strong> cookies for advertising or cross-site tracking</li>
      </ul>

      <h2>6. Cookies and Local Storage</h2>

      <p>
        Kernel uses the following browser storage technologies. None are used for advertising
        or cross-site tracking:
      </p>

      <ul>
        <li><strong>Authentication tokens:</strong> Supabase stores a JWT session token in localStorage to keep you signed in across visits</li>
        <li><strong>Application state:</strong> Kernel stores UI preferences and conversation state in localStorage using the Zustand state management library (store name: &ldquo;sovereign-kernel&rdquo;)</li>
        <li><strong>Analytics cookies:</strong> PostHog may set a first-party cookie to track anonymous usage patterns (page views, feature usage). This data is used solely for improving Kernel and is not shared with advertisers</li>
        <li><strong>OAuth flags:</strong> Temporary localStorage entries are used during social sign-in flows (Google, GitHub, X) and are cleared after authentication completes</li>
      </ul>

      <p>
        You can clear all local data at any time through your browser settings. Clearing localStorage
        will sign you out but will not delete your account data stored on our servers.
      </p>

      <h2>7. Third-Party Services</h2>

      <p>Kernel relies on the following third-party services:</p>

      <ul>
        <li><strong>Supabase</strong> (supabase.com) &mdash; Authentication, PostgreSQL database, edge functions, and file storage. Your data is stored on Supabase's infrastructure. Supabase processes data in accordance with their <a href="https://supabase.com/privacy" target="_blank" rel="noopener">privacy policy</a> and we maintain a data processing agreement with them.</li>
        <li><strong>Anthropic</strong> (anthropic.com) &mdash; Claude language models power Kernel's default responses. Your messages and relevant context are sent to Anthropic's API for processing. When Kernel performs web searches, it uses Claude's built-in web search capability &mdash; search queries (not your full conversation) are sent through Anthropic's API. Anthropic's <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener">usage policy</a> applies to all processing. Anthropic does not use API inputs to train models.</li>
        <li><strong>OpenAI</strong> (openai.com) &mdash; Audio transcription (Whisper) and text-to-speech services. When you send voice messages, audio is transcribed via OpenAI's API. When Kernel reads responses aloud, speech is generated via OpenAI's TTS API. Additionally, OpenAI models (GPT-4o) are available as an alternative AI provider if you select them. OpenAI's <a href="https://openai.com/policies/row-privacy-policy/" target="_blank" rel="noopener">privacy policy</a> applies. Conversation content is sent to OpenAI only when these features are used.</li>
        <li><strong>Google</strong> (google.com) &mdash; Gemini language models are available as an alternative AI provider if you select them. When a Gemini model is active, your messages and context are sent to Google's API for processing. Google's <a href="https://policies.google.com/privacy" target="_blank" rel="noopener">privacy policy</a> applies.</li>
        <li><strong>NVIDIA</strong> (nvidia.com) &mdash; Open-source language models (Llama) hosted by NVIDIA are available as an alternative AI provider if you select them. When an NVIDIA-hosted model is active, your messages and context are sent to NVIDIA's API. NVIDIA's <a href="https://www.nvidia.com/en-us/about-nvidia/privacy-policy/" target="_blank" rel="noopener">privacy policy</a> applies.</li>
        <li><strong>Stripe</strong> (stripe.com) &mdash; Payment processing for Pro subscriptions. Stripe's <a href="https://stripe.com/privacy" target="_blank" rel="noopener">privacy policy</a> governs payment data.</li>
        <li><strong>PostHog</strong> (posthog.com) &mdash; Product analytics. Collects anonymous usage data (page views, feature interactions, session duration) to help us understand how Kernel is used. PostHog's <a href="https://posthog.com/privacy" target="_blank" rel="noopener">privacy policy</a> applies. We do not send conversation content to PostHog.</li>
        <li><strong>Sentry</strong> (sentry.io) &mdash; Error monitoring. When Kernel encounters a software error, Sentry captures the error details (stack trace, browser info, error message) to help us fix bugs. Sentry's <a href="https://sentry.io/privacy/" target="_blank" rel="noopener">privacy policy</a> applies. Conversation content is not included in error reports.</li>
        <li><strong>Resend</strong> (resend.com) &mdash; Transactional and announcement emails. Your email address is shared with Resend for the purpose of sending service communications. Resend's <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener">privacy policy</a> applies.</li>
      </ul>

      <p>
        <strong>What we send to AI providers:</strong> Your message, recent conversation history,
        a summary of your memory profile, relevant knowledge graph entries, and convergence
        insights. We do not send your full conversation archive or raw facet data. The same
        context is sent regardless of which AI provider processes your message. By default,
        Kernel uses Anthropic's Claude models. Alternative providers (OpenAI, Google, NVIDIA)
        only receive your data when you explicitly select one of their models.
      </p>

      <p>
        We maintain data processing agreements (DPAs) with our sub-processors where required.
        A current list of sub-processors is available upon request by contacting us
        at <a href="mailto:isaacsight@gmail.com">isaacsight@gmail.com</a>.
      </p>

      <h2>8. International Data Transfers</h2>

      <p>
        Kernel's infrastructure is hosted in the United States through Supabase (AWS). If you are
        located outside the United States, your data will be transferred to and processed in the
        United States.
      </p>

      <p>
        For users in the European Economic Area (EEA), United Kingdom, or Switzerland, we rely on
        the following safeguards for international data transfers:
      </p>

      <ul>
        <li>Standard Contractual Clauses (SCCs) approved by the European Commission, incorporated into our agreements with sub-processors</li>
        <li>The EU-U.S. Data Privacy Framework, where applicable to our sub-processors who have self-certified</li>
        <li>Your explicit consent, provided when you create an account and agree to this policy</li>
      </ul>

      <p>
        You may request information about the specific safeguards applied to your data
        by contacting us.
      </p>

      <h2>9. Data Retention</h2>

      <ul>
        <li><strong>Conversations:</strong> Retained until you delete them or delete your account</li>
        <li><strong>Memory profile:</strong> Retained until you reset your memory or delete your account</li>
        <li><strong>Knowledge graph:</strong> Retained until you reset it or delete your account</li>
        <li><strong>Perception facets and insights:</strong> Retained until you reset your memory or delete your account</li>
        <li><strong>Audit logs:</strong> Automatically purged after 90 days</li>
        <li><strong>Rate limit records:</strong> Automatically purged after expiration</li>
        <li><strong>Shared conversations:</strong> Public links remain accessible until you delete the conversation</li>
        <li><strong>Account data after deletion:</strong> When you delete your account, all associated data is permanently removed from our database. Backups may retain data for up to 30 days before being purged.</li>
      </ul>

      <p>
        We retain personal data only for as long as necessary to fulfill the purposes described
        in this policy, or as required by law. We periodically review stored data and delete
        information that is no longer needed.
      </p>

      <h2>10. Data Security</h2>

      <p>We implement the following security measures:</p>

      <ul>
        <li><strong>Encryption in transit:</strong> All data transmitted over HTTPS/TLS encryption</li>
        <li><strong>Encryption at rest:</strong> Database and file storage are encrypted at rest using AES-256 encryption provided by our infrastructure provider (Supabase/AWS)</li>
        <li>Authentication via Supabase Auth with secure JWT tokens</li>
        <li>Row-level security (RLS) on all database tables &mdash; you can only access your own data</li>
        <li>Sensitive operations (email change, password change) require identity verification</li>
        <li>Rate limiting on all API endpoints to prevent abuse</li>
        <li>Structured audit logging for security-relevant operations</li>
        <li>SSRF protection on all server-side URL fetching</li>
        <li>Input validation and content-type checking on all edge functions</li>
        <li>Server-side protection of critical fields (message counts cannot be manipulated client-side)</li>
      </ul>

      <p>
        No system is perfectly secure. If you discover a vulnerability, please report it to{' '}
        <a href="mailto:isaacsight@gmail.com">isaacsight@gmail.com</a>.
      </p>

      <h2>11. Data Breach Notification</h2>

      <p>
        In the event of a data breach that affects your personal information, we will:
      </p>

      <ul>
        <li>Notify affected users by email without unreasonable delay, and in any event within 72 hours of becoming aware of the breach, where feasible</li>
        <li>Notify the relevant supervisory authority within 72 hours where required by GDPR</li>
        <li>Describe the nature of the breach, the categories of data affected, and the approximate number of users affected</li>
        <li>Describe the likely consequences of the breach and the measures taken or proposed to address it</li>
        <li>Provide contact information for follow-up questions</li>
      </ul>

      <p>
        If the breach is unlikely to result in a risk to your rights and freedoms, we may
        not notify you individually but will document the breach internally.
      </p>

      <h2>12. Your Rights</h2>

      <p>
        Regardless of where you are located, you have the following rights over your data:
      </p>

      <ul>
        <li><strong>Access:</strong> Your conversations, memory profile, knowledge graph, goals, and briefings are all visible within the app</li>
        <li><strong>Correction:</strong> You can update your profile information at any time through account settings</li>
        <li><strong>Deletion:</strong> You can delete individual conversations, reset specific data categories (conversations, memory, knowledge graph, goals, preferences), or delete your entire account. Deletion is permanent and irreversible.</li>
        <li><strong>Export:</strong> You can share and export conversations via the share feature</li>
        <li><strong>Portability:</strong> You can download a complete copy of your data in JSON format from Account Settings using the &ldquo;Export my data&rdquo; button</li>
        <li><strong>Objection:</strong> You can request that we stop processing your data for specific purposes by contacting us</li>
        <li><strong>Restriction:</strong> You can request that we restrict the processing of your data while a dispute is being resolved or while we verify the accuracy of your data</li>
        <li><strong>Automated decisions:</strong> You have the right to not be subject to decisions based solely on automated processing that produce legal or similarly significant effects. As described in Section 4, Kernel's automated processes affect only AI response quality and personalization, not legal or significant decisions. You may request human review of any automated decision by contacting us.</li>
      </ul>

      <p>
        To exercise any of these rights, use the in-app tools (account settings, deletion controls)
        or contact us at <a href="mailto:isaacsight@gmail.com">isaacsight@gmail.com</a>. We will
        respond to requests within 30 days.
      </p>

      <h3>For California Residents (CCPA/CPRA)</h3>
      <p>
        Under the California Consumer Privacy Act and California Privacy Rights Act, you have
        the right to:
      </p>
      <ul>
        <li>Know what personal information we collect, use, and disclose</li>
        <li>Request deletion of your personal information</li>
        <li>Opt out of the sale or sharing of your personal information &mdash; we do not sell or share personal information as defined by the CCPA/CPRA</li>
        <li>Non-discrimination for exercising your privacy rights</li>
        <li>Correct inaccurate personal information</li>
        <li>Limit use and disclosure of sensitive personal information</li>
      </ul>
      <p>
        To exercise your rights, use the in-app deletion tools or contact us. We will verify your
        identity before processing requests. We do not sell personal information and have not done
        so in the preceding 12 months.
      </p>

      <h3>For EU/EEA Residents (GDPR)</h3>
      <p>
        We process your data under the following legal bases:
      </p>
      <ul>
        <li><strong>Contract performance (Art. 6(1)(b)):</strong> Account data, conversations, and AI responses &mdash; necessary to provide the Kernel service you signed up for</li>
        <li><strong>Consent (Art. 6(1)(a)):</strong> Memory profiling, knowledge graph building, perception facets, and convergence &mdash; you consent to these when you agree to this policy. You may withdraw consent at any time by resetting your memory or deleting your account.</li>
        <li><strong>Legitimate interest (Art. 6(1)(f)):</strong> Security measures (rate limiting, audit logging, abuse prevention) and aggregate usage analytics &mdash; necessary for protecting the service and improving it. These interests are balanced against your rights and do not override your fundamental freedoms.</li>
      </ul>
      <p>
        You have the right to withdraw consent at any time by deleting your account or resetting
        specific data categories. Withdrawal does not affect the lawfulness of processing
        performed before withdrawal.
      </p>
      <p>
        You have the right to lodge a complaint with your local data protection authority. A list
        of EU/EEA data protection authorities is available
        at <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" target="_blank" rel="noopener">edpb.europa.eu</a>.
      </p>

      <h2>13. Children</h2>

      <p>
        Kernel is not intended for users under the age of 13 (or 16 in the EU/EEA). We do not
        knowingly collect personal information from children under these ages.
      </p>

      <p>
        We do not use age verification technology. Account creation requires an email address,
        and by creating an account, the user represents that they meet the minimum age requirement.
      </p>

      <p>
        If we become aware that we have collected personal information from a child under the
        applicable minimum age, we will take the following steps:
      </p>

      <ul>
        <li>Immediately suspend the account to prevent further data collection</li>
        <li>Delete all personal information associated with the account, including conversations, memory profiles, knowledge graphs, perception data, and uploaded files</li>
        <li>Notify the parent or guardian if their contact information is available</li>
      </ul>

      <p>
        We do not use children's data to train AI models, build profiles, or for any purpose
        other than providing the service.
      </p>

      <p>
        If you believe a child has created an account, please contact us immediately
        at <a href="mailto:isaacsight@gmail.com">isaacsight@gmail.com</a> and we will take
        prompt action.
      </p>

      <h2>14. Changes to This Policy</h2>

      <p>
        We may update this policy as Kernel evolves. When we make material changes &mdash;
        especially changes to how we collect, use, or share your data &mdash; we will notify you
        through the app or by email at least thirty (30) days before the changes take effect.
        If you do not agree with the revised policy, you may delete your account before the
        changes become effective. Continued use of Kernel after the effective date constitutes
        acceptance of the updated policy.
      </p>

      <h2>15. Contact</h2>

      <p>
        For questions about this policy, your data, or to exercise your rights:
      </p>
      <p>
        <strong>Email:</strong> <a href="mailto:isaacsight@gmail.com">isaacsight@gmail.com</a><br />
        <strong>Operator:</strong> Isaac Hernandez<br />
        <strong>Service:</strong> Kernel (kernel.chat)<br />
        <strong>Response time:</strong> We aim to respond to all privacy-related requests within 30 days
      </p>

      <p>
        For EU/EEA residents, Isaac Hernandez serves as the data controller for personal data
        processed by Kernel. If you have concerns about our data practices that we have not
        adequately addressed, you have the right to lodge a complaint with your local data
        protection authority.
      </p>
    </div>
  )
}
