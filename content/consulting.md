---
title: 'Consulting'
category: Services
excerpt: Let's fix your problem.
---

<div style="font-family: var(--font-serif); max-width: 600px; margin: 0 auto;">

<h1 style="font-size: 2.5rem; margin-bottom: 1rem; line-height: 1.2;">Let’s Fix Your Problem.</h1>

<p style="font-size: 1.2rem; color: var(--text-muted); margin-bottom: 2rem; line-height: 1.6;">
    Tell me who you are, how to reach you, and the problem you’re trying to solve. It doesn’t need to be formal—just write what’s on your mind, what’s not working, or what you want to create.
</p>

<p style="font-size: 1.2rem; line-height: 1.6;">
    Email me anytime at <a href="mailto:isaacsight@gmail.com" style="color: var(--text-main); text-decoration: underline; text-underline-offset: 4px;">isaacsight@gmail.com</a> or use the form below.
</p>

<form id="consulting-form" class="consulting-form">
    <div class="form-group">
        <label for="name">Name</label>
        <input type="text" id="name" name="name" required placeholder="Jane Doe">
    </div>
    
    <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required placeholder="jane@example.com">
    </div>
    
    <div class="form-group">
        <label for="message">How can I help?</label>
        <textarea id="message" name="message" rows="5" required maxlength="5000" placeholder="Tell me about your project..."></textarea>
    </div>

    <button type="submit" class="submit-btn">Send Message</button>
</form>

<div id="form-success" style="display: none; text-align: center; padding: 2rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; color: #166534;">
    <h3 style="margin-top: 0;">Message Sent</h3>
    <p>Thanks for reaching out. I'll get back to you shortly.</p>
</div>

</div>

<script src="{{ root }}js/consulting.js"></script>
