From a9d1c028b4af9e020ef2c2d604345a76fb5f4a10 Mon Sep 17 00:00:00 2001
From: Aravind Sasi <aravind@example.com>
Date: Sun, 1 Nov 2026 15:05:39 +0000
Subject: [PATCH] Add script.js: smooth scrolling, mobile menu, form validation

- Add script.js and link it at the end of <body> in index.html
- Smooth scrolling for all in-page links (respects reduced-motion,
  updates URL hash, moves keyboard focus to the target section)
- Mobile menu toggle: hamburger button with aria-expanded, closes on
  link click, Escape, outside click and when resized to desktop
- Contact form validation for email and message with inline error
  messages, red invalid state, first-error focus, and double-submit guard
- Console logging prefixed [Portfolio] (toggle with DEBUG flag), per-feature
  try/catch via safeInit, and global error/unhandledrejection handlers
- CSS: add styles for menu button, field errors and focus; collapse nav on
  mobile only when JS is active so the menu still works without JS
---
 index.html |  21 +++-
 script.js  | 335 +++++++++++++++++++++++++++++++++++++++++++++++++++++
 style.css  |  77 ++++++++++++
 3 files changed, 430 insertions(+), 3 deletions(-)
 create mode 100644 script.js

diff --git a/index.html b/index.html
index 7e6aa5e..b8336e6 100644
--- a/index.html
+++ b/index.html
@@ -15,7 +15,11 @@
             <nav class="navbar">
                 <h2>Aravind.</h2>
 
-                <div class="nav-links">
+                <!-- Mobile menu button (hidden on desktop and when JS is off; see style.css / script.js) -->
+                <button class="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false"
+                    aria-controls="nav-links">☰</button>
+
+                <div class="nav-links" id="nav-links">
                     <a href="#about">About</a>
                     <a href="#skills">Skills</a>
                     <a href="#projects">Projects</a>
@@ -77,8 +81,15 @@
             <section id="contact">
                 <h2>Contact Me</h2>
                 <form class="contact-form" action="https://formspree.io/f/xasaeradi" method="POST">
-                    <input type="email" name="email" placeholder="Your Email" required>
-                    <textarea name="message" placeholder="Your Message" rows="5" required></textarea>
+                    <input type="email" name="email" placeholder="Your Email" required
+                        aria-describedby="email-error">
+                    <!-- script.js writes validation messages into these empty elements -->
+                    <p class="field-error" id="email-error"></p>
+
+                    <textarea name="message" placeholder="Your Message" rows="5" required
+                        aria-describedby="message-error"></textarea>
+                    <p class="field-error" id="message-error"></p>
+
                     <button type="submit">Send Message</button>
                 </form>
             </section>
@@ -89,5 +100,9 @@
         </footer>
     </div>
 
+    <!-- JavaScript: smooth scrolling, mobile menu, form validation.
+         Placed at the end of <body> so all elements above already exist when it runs. -->
+    <script src="script.js"></script>
+
 </body>
 </html>
\ No newline at end of file
diff --git a/script.js b/script.js
new file mode 100644
index 0000000..6edbc52
--- /dev/null
+++ b/script.js
@@ -0,0 +1,335 @@
+/* ==========================================================================
+   script.js - Aravind's portfolio
+   Features:
+     1. Smooth scrolling for menu links
+     2. Mobile menu toggle
+     3. Contact form validation
+   Debugging: open the browser DevTools (F12) > Console and look for
+   messages starting with [Portfolio]. Set DEBUG to false to silence the
+   normal logs (warnings and errors always show).
+   ========================================================================== */
+
+'use strict'; // Makes JavaScript stricter so common mistakes throw errors
+
+
+/* --------------------------------------------------------------------------
+   0. SETTINGS & HELPERS
+   -------------------------------------------------------------------------- */
+
+const DEBUG = true;               // true = show detailed logs in the console
+const MOBILE_BREAKPOINT = 650;    // px - must match the @media (max-width) in style.css
+
+// Rules used by the contact form validation
+const FORM_RULES = {
+    messageMin: 10,               // shortest message allowed (characters)
+    messageMax: 1000              // longest message allowed (characters)
+};
+
+// Simple email check: something@something.something (no spaces)
+const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
+
+// Logging helpers. The prefix makes our messages easy to find in a busy console.
+const log = (...args) => { if (DEBUG) console.log('[Portfolio]', ...args); };
+const warn = (...args) => console.warn('[Portfolio]', ...args);
+const logError = (...args) => console.error('[Portfolio]', ...args);
+
+// Safety nets: report any error we forgot to catch, instead of failing silently.
+window.addEventListener('error', (event) => {
+    logError('Uncaught error:', event.message, `(${event.filename}:${event.lineno}:${event.colno})`);
+});
+window.addEventListener('unhandledrejection', (event) => {
+    logError('Unhandled promise rejection:', event.reason);
+});
+
+/**
+ * Runs one feature's setup function inside try/catch.
+ * If one feature breaks, the others still work and the console tells you which one failed.
+ */
+function safeInit(name, initFunction) {
+    try {
+        initFunction();
+    } catch (error) {
+        logError(`✖ ${name} failed to start:`, error);
+    }
+}
+
+
+/* --------------------------------------------------------------------------
+   1. SMOOTH SCROLLING FOR MENU LINKS
+   Handles every link that points to a section on this page (href="#about", etc.),
+   including the "View My Projects" button in the hero.
+   -------------------------------------------------------------------------- */
+
+function initSmoothScrolling() {
+    const links = document.querySelectorAll('a[href^="#"]');
+
+    if (links.length === 0) {
+        warn('Smooth scrolling: no in-page links found.');
+        return;
+    }
+
+    // Visitors who turn on "reduce motion" in their system settings should not get animation
+    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
+
+    links.forEach((link) => {
+        link.addEventListener('click', (event) => {
+            try {
+                const hash = link.getAttribute('href');                 // e.g. "#about"
+                const targetId = hash.slice(1);                         // e.g. "about"
+                const target = targetId ? document.getElementById(targetId) : document.body;
+
+                // If the section doesn't exist, let the browser do its default thing and tell us why
+                if (!target) {
+                    warn(`Smooth scrolling: no element with id="${targetId}" (link: ${hash})`);
+                    return;
+                }
+
+                event.preventDefault(); // Stop the instant "jump"; we scroll smoothly instead
+
+                target.scrollIntoView({
+                    behavior: reduceMotion.matches ? 'instant' : 'smooth',
+                    block: 'start'
+                });
+
+                // Update the address bar (e.g. ...index.html#about) so the link can be shared.
+                // Separate try/catch: some environments block this, and that shouldn't stop scrolling.
+                try {
+                    history.pushState(null, '', hash);
+                } catch (historyError) {
+                    warn('Could not update the URL hash:', historyError.message);
+                }
+
+                // Move keyboard focus to the section so keyboard/screen-reader users land there too
+                if (targetId) {
+                    target.setAttribute('tabindex', '-1');
+                    target.focus({ preventScroll: true });
+                }
+
+                log(`Smooth scrolled to ${hash}`);
+            } catch (error) {
+                logError('Smooth scrolling failed for link:', link, error);
+            }
+        });
+    });
+
+    log(`✔ Smooth scrolling ready on ${links.length} links`);
+}
+
+
+/* --------------------------------------------------------------------------
+   2. MOBILE MENU TOGGLE
+   Shows/hides the nav links on small screens using the ☰ button.
+   -------------------------------------------------------------------------- */
+
+function initMobileMenu() {
+    const toggleButton = document.querySelector('.menu-toggle');
+    const navLinks = document.getElementById('nav-links');
+
+    // If the HTML is missing, stop here and DON'T hide the menu (see the next step)
+    if (!toggleButton || !navLinks) {
+        warn('Mobile menu: .menu-toggle button or #nav-links not found. Menu left as-is.');
+        return;
+    }
+
+    // Tells the CSS "JavaScript is working", so it's safe to collapse the menu on mobile.
+    // Without JS (or if this function stops above), the menu simply stays visible.
+    document.documentElement.classList.add('js');
+
+    /** Opens or closes the menu and keeps the button's accessibility info in sync. */
+    function setMenuOpen(isOpen) {
+        navLinks.classList.toggle('open', isOpen);
+        toggleButton.setAttribute('aria-expanded', String(isOpen));
+        toggleButton.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
+        toggleButton.textContent = isOpen ? '✕' : '☰';
+        log(`Mobile menu ${isOpen ? 'opened' : 'closed'}`);
+    }
+
+    const isMenuOpen = () => navLinks.classList.contains('open');
+
+    // Click the ☰ button: flip between open and closed
+    toggleButton.addEventListener('click', () => setMenuOpen(!isMenuOpen()));
+
+    // Click a menu link: close the menu (the page scrolls to the section)
+    navLinks.querySelectorAll('a').forEach((link) => {
+        link.addEventListener('click', () => {
+            if (isMenuOpen()) setMenuOpen(false);
+        });
+    });
+
+    // Press Escape: close the menu and return focus to the button
+    document.addEventListener('keydown', (event) => {
+        if (event.key === 'Escape' && isMenuOpen()) {
+            setMenuOpen(false);
+            toggleButton.focus();
+        }
+    });
+
+    // Click anywhere outside the menu: close it
+    document.addEventListener('click', (event) => {
+        const clickedInside = navLinks.contains(event.target) || toggleButton.contains(event.target);
+        if (isMenuOpen() && !clickedInside) setMenuOpen(false);
+    });
+
+    // Screen grows to desktop size (e.g. rotating a tablet): reset the menu state
+    const desktopQuery = window.matchMedia(`(min-width: ${MOBILE_BREAKPOINT + 1}px)`);
+    desktopQuery.addEventListener('change', (event) => {
+        if (event.matches && isMenuOpen()) setMenuOpen(false);
+    });
+
+    log('✔ Mobile menu ready');
+}
+
+
+/* --------------------------------------------------------------------------
+   3. CONTACT FORM VALIDATION
+   Checks the email and message before sending. If something is wrong, it shows
+   a message under the field and stops the form from being submitted.
+   -------------------------------------------------------------------------- */
+
+/** Returns an error message for the email, or "" if it's valid. */
+function validateEmail(value) {
+    const email = value.trim();
+    if (email === '') return 'Please enter your email address.';
+    if (!EMAIL_PATTERN.test(email)) return 'Please enter a valid email address, like name@example.com.';
+    return '';
+}
+
+/** Returns an error message for the message, or "" if it's valid. */
+function validateMessage(value) {
+    const message = value.trim();
+    if (message === '') return 'Please write a message.';
+    if (message.length < FORM_RULES.messageMin) {
+        return `Your message is too short. Please write at least ${FORM_RULES.messageMin} characters (you have ${message.length}).`;
+    }
+    if (message.length > FORM_RULES.messageMax) {
+        return `Your message is too long. Please keep it under ${FORM_RULES.messageMax} characters (you have ${message.length}).`;
+    }
+    return '';
+}
+
+function initContactForm() {
+    const form = document.querySelector('.contact-form');
+    if (!form) {
+        warn('Contact form: .contact-form not found.');
+        return;
+    }
+
+    const emailInput = form.querySelector('input[name="email"]');
+    const messageInput = form.querySelector('textarea[name="message"]');
+    const emailError = document.getElementById('email-error');
+    const messageError = document.getElementById('message-error');
+    const submitButton = form.querySelector('button[type="submit"]');
+
+    // Check everything we need exists, and say exactly which piece is missing
+    const missing = [];
+    if (!emailInput) missing.push('input[name="email"]');
+    if (!messageInput) missing.push('textarea[name="message"]');
+    if (!emailError) missing.push('#email-error');
+    if (!messageError) missing.push('#message-error');
+    if (!submitButton) missing.push('button[type="submit"]');
+    if (missing.length > 0) {
+        warn('Contact form: missing elements, validation not started:', missing.join(', '));
+        return; // Form still works normally with the browser's built-in checks
+    }
+
+    // Turn off the browser's own pop-up bubbles so our messages are the only ones shown.
+    // Done here (not in the HTML) so the browser's checks still work if this script fails to load.
+    form.noValidate = true;
+
+    // One entry per field, so the same code can handle both
+    const fields = [
+        { name: 'email', input: emailInput, errorBox: emailError, validate: validateEmail },
+        { name: 'message', input: messageInput, errorBox: messageError, validate: validateMessage }
+    ];
+
+    /** Validates one field, shows or clears its error message, and returns true if valid. */
+    function checkField(field) {
+        const errorText = field.validate(field.input.value);
+        field.errorBox.textContent = errorText;
+
+        if (errorText) {
+            field.input.setAttribute('aria-invalid', 'true');   // CSS shows a red border; screen readers announce it
+        } else {
+            field.input.removeAttribute('aria-invalid');
+        }
+
+        log(`Validation "${field.name}":`, errorText || 'OK');
+        return errorText === '';
+    }
+
+    fields.forEach((field) => {
+        // When the visitor leaves a field, check it
+        field.input.addEventListener('blur', () => {
+            // Don't nag about an untouched empty field when someone just tabs through
+            if (field.input.value.trim() !== '' || field.input.hasAttribute('aria-invalid')) {
+                checkField(field);
+            }
+        });
+
+        // While typing in a field that already shows an error, re-check so the error clears as soon as it's fixed
+        field.input.addEventListener('input', () => {
+            if (field.input.hasAttribute('aria-invalid')) checkField(field);
+        });
+    });
+
+    // When the visitor presses "Send Message"
+    form.addEventListener('submit', (event) => {
+        try {
+            // Check every field (not just the first bad one) so all errors show at once
+            const results = fields.map((field) => ({ field, valid: checkField(field) }));
+            const firstInvalid = results.find((result) => !result.valid);
+
+            if (firstInvalid) {
+                event.preventDefault();             // Stop the form from being sent
+                firstInvalid.field.input.focus();   // Jump to the first problem
+                log('Form NOT sent: validation errors found');
+                return;
+            }
+
+            // All good: the form goes to Formspree as normal.
+            // Disable the button so a double-click can't send the message twice.
+            submitButton.disabled = true;
+            submitButton.textContent = 'Sending...';
+            log('Form valid, sending to:', form.action);
+        } catch (error) {
+            // Our validation code crashed. Fall back to the browser's built-in checks
+            // so the visitor can still contact you.
+            logError('Form validation crashed, using browser validation instead:', error);
+            event.preventDefault();
+            form.noValidate = false;
+            if (form.checkValidity()) {
+                form.submit();
+            } else {
+                form.reportValidity();
+            }
+        }
+    });
+
+    // If the visitor presses the browser's Back button after sending, the page may come back
+    // with the button still disabled. Reset it.
+    window.addEventListener('pageshow', (event) => {
+        if (event.persisted) {
+            submitButton.disabled = false;
+            submitButton.textContent = 'Send Message';
+            log('Page restored from cache: submit button reset');
+        }
+    });
+
+    log('✔ Contact form validation ready');
+}
+
+
+/* --------------------------------------------------------------------------
+   START EVERYTHING
+   Each feature starts independently, so a bug in one won't break the others.
+   -------------------------------------------------------------------------- */
+
+log('script.js loaded');
+
+// ORDER MATTERS: the mobile menu must start BEFORE smooth scrolling.
+// Click handlers run in the order they were added, so this makes the menu close
+// first. Otherwise the page would measure the scroll distance while the menu is
+// still open, then the menu would collapse and the page would overshoot the section.
+safeInit('Mobile menu', initMobileMenu);
+safeInit('Smooth scrolling', initSmoothScrolling);
+safeInit('Contact form validation', initContactForm);
diff --git a/style.css b/style.css
index d8af8f3..29d3f23 100644
--- a/style.css
+++ b/style.css
@@ -130,6 +130,62 @@ section h2 {
     cursor: pointer;
 }
 
+/* ---------- Added for script.js: form validation ---------- */
+
+/* Error message shown under a field (empty = hidden, so it adds no extra space) */
+.field-error {
+    color: #b42318;
+    font-size: 14px;
+    text-align: left;
+}
+
+.field-error:empty {
+    display: none;
+}
+
+/* Red border on a field that failed validation (set by script.js via aria-invalid) */
+.contact-form [aria-invalid="true"] {
+    border-color: #b42318;
+}
+
+/* Visible keyboard focus on form fields */
+.contact-form input:focus,
+.contact-form textarea:focus {
+    outline: 2px solid #1455a0;
+    outline-offset: 1px;
+}
+
+/* Submit button while the form is being sent */
+.contact-form button:disabled {
+    opacity: 0.7;
+    cursor: not-allowed;
+}
+
+/* ---------- Added for script.js: mobile menu button ---------- */
+
+/* Hidden everywhere by default; only shown on small screens (see media query below) */
+.menu-toggle {
+    display: none;
+    background: transparent;
+    color: white;
+    border: 1px solid rgba(255, 255, 255, 0.5);
+    border-radius: 8px;
+    padding: 4px 12px;
+    font-size: 22px;
+    line-height: 1.4;
+    cursor: pointer;
+}
+
+.menu-toggle:hover {
+    color: #61dafb;
+    border-color: #61dafb;
+}
+
+.menu-toggle:focus-visible {
+    outline: 2px solid #61dafb;
+    outline-offset: 2px;
+}
+
 footer {
     background: #102a43;
     color: white;
@@ -148,6 +204,27 @@ footer {
         gap: 12px;
     }
 
+    /* Mobile menu: only active when script.js has added the "js" class to <html>.
+       If JavaScript fails, the original always-visible menu above still works. */
+    .js .navbar {
+        flex-direction: row;        /* logo on the left, ☰ button on the right */
+    }
+
+    .js .menu-toggle {
+        display: block;
+    }
+
+    .js .nav-links {
+        display: none;              /* collapsed until the button is pressed */
+        width: 100%;                /* drops onto its own row under the logo */
+        flex-direction: column;
+        align-items: center;
+    }
+
+    .js .nav-links.open {
+        display: flex;              /* shown when script.js adds the "open" class */
+    }
+
     .hero h1 {
         font-size: 30px;
     }
-- 
2.43.0