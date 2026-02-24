export function PrivacyPage() {
  return (
    <div className="ka-legal-page">
      <button className="ka-legal-back" onClick={() => { window.location.hash = '#/' }}>
        &larr; Back to Kernel
      </button>

      <h1>Privacy Policy</h1>
      <p className="ka-legal-updated">Last updated: February 24, 2026</p>

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

      <h2>4. What We Do Not Do</h2>

      <ul>
        <li>We <strong>do not sell</strong> your personal data to anyone, for any reason</li>
        <li>We <strong>do not use</strong> your conversations to train or fine-tune AI models</li>
        <li>We <strong>do not share</strong> your data with advertisers or data brokers</li>
        <li>We <strong>do not share</strong> your perception facets, convergence insights, or memory profile with any third party</li>
        <li>We <strong>do not allow</strong> other users to access your profile, memory, conversations, or any derived data</li>
        <li>We <strong>do not track</strong> you across other websites or apps</li>
        <li>We <strong>do not use</strong> cookies for advertising or cross-site tracking</li>
      </ul>

      <h2>5. Third-Party Services</h2>

      <p>Kernel relies on the following third-party services:</p>

      <ul>
        <li><strong>Supabase</strong> (supabase.com) &mdash; Authentication, PostgreSQL database, edge functions, and file storage. Your data is stored on Supabase's infrastructure.</li>
        <li><strong>Anthropic</strong> (anthropic.com) &mdash; Claude language models power Kernel's responses. Your messages and relevant context are sent to Anthropic's API for processing. Anthropic's <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener">usage policy</a> applies to that processing. Anthropic does not use API inputs to train models.</li>
        <li><strong>Stripe</strong> (stripe.com) &mdash; Payment processing for Pro subscriptions. Stripe's <a href="https://stripe.com/privacy" target="_blank" rel="noopener">privacy policy</a> governs payment data.</li>
        <li><strong>Perplexity</strong> (perplexity.ai) &mdash; Web search when Kernel needs current information. Search queries are sent to Perplexity's API.</li>
      </ul>

      <p>
        <strong>What we send to the AI model:</strong> Your message, recent conversation history,
        a summary of your memory profile, relevant knowledge graph entries, and convergence
        insights. We do not send your full conversation archive or raw facet data.
      </p>

      <h2>6. Data Retention</h2>

      <ul>
        <li><strong>Conversations:</strong> Retained until you delete them or delete your account</li>
        <li><strong>Memory profile:</strong> Retained until you reset your memory or delete your account</li>
        <li><strong>Knowledge graph:</strong> Retained until you reset it or delete your account</li>
        <li><strong>Perception facets and insights:</strong> Retained until you reset your memory or delete your account</li>
        <li><strong>Audit logs:</strong> Automatically purged after 90 days</li>
        <li><strong>Rate limit records:</strong> Automatically purged after expiration</li>
        <li><strong>Shared conversations:</strong> Public links remain accessible until you delete the conversation</li>
      </ul>

      <h2>7. Data Security</h2>

      <p>We implement the following security measures:</p>

      <ul>
        <li>All data transmitted over HTTPS/TLS encryption</li>
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

      <h2>8. Your Rights</h2>

      <p>
        Regardless of where you are located, you have the following rights over your data:
      </p>

      <ul>
        <li><strong>Access:</strong> Your conversations, memory profile, knowledge graph, goals, and briefings are all visible within the app</li>
        <li><strong>Correction:</strong> You can update your profile information at any time through account settings</li>
        <li><strong>Deletion:</strong> You can delete individual conversations, reset specific data categories (conversations, memory, knowledge graph, goals, preferences), or delete your entire account. Deletion is permanent and irreversible.</li>
        <li><strong>Export:</strong> You can share and export conversations via the share feature</li>
        <li><strong>Portability:</strong> You can request a copy of your data by contacting us</li>
        <li><strong>Objection:</strong> You can request that we stop processing your data for specific purposes by contacting us</li>
      </ul>

      <h3>For California Residents (CCPA)</h3>
      <p>
        Under the California Consumer Privacy Act, you have the right to know what personal
        information we collect, request deletion of your data, and opt out of the sale of your
        data. We do not sell personal information. To exercise your rights, use the in-app
        deletion tools or contact us.
      </p>

      <h3>For EU/EEA Residents (GDPR)</h3>
      <p>
        Our legal basis for processing your data is your consent (provided when you create an
        account and agree to these terms) and the performance of our contract with you (providing
        the Kernel service). You have the right to withdraw consent at any time by deleting your
        account. You also have the right to lodge a complaint with your local data protection
        authority.
      </p>

      <h2>9. Children</h2>

      <p>
        Kernel is not intended for users under the age of 13 (or 16 in the EU/EEA). We do not
        knowingly collect personal information from children. If you believe a child has created
        an account, please contact us and we will delete it.
      </p>

      <h2>10. Changes to This Policy</h2>

      <p>
        We may update this policy as Kernel evolves. When we make significant changes &mdash;
        especially changes to how we collect, use, or share your data &mdash; we will notify you
        through the app. Continued use of Kernel after changes constitutes acceptance of the
        updated policy.
      </p>

      <h2>11. Contact</h2>

      <p>
        For questions about this policy, your data, or to exercise your rights:
      </p>
      <p>
        <strong>Email:</strong> <a href="mailto:isaacsight@gmail.com">isaacsight@gmail.com</a><br />
        <strong>Operator:</strong> Isaac Hernandez<br />
        <strong>Service:</strong> Kernel (kernel.chat)
      </p>
    </div>
  )
}
