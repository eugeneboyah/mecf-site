// Mother Evelyn Child-Care Foundation — shared site behavior

document.addEventListener('DOMContentLoaded', () => {
  /* Animated stat counters */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const formatNumber = (n) => n.toLocaleString('en-US');
    const animateCounter = (el) => {
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      const duration = 1400;
      const start = performance.now();
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReduced) {
        el.textContent = formatNumber(target) + suffix;
        return;
      }
      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = formatNumber(Math.round(target * eased)) + suffix;
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(el => observer.observe(el));
  }

  /* Mobile nav toggle */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => links.classList.remove('open'));
    });
  }

  /* Back to top */
  const toTop = document.querySelector('.to-top');
  if (toTop) {
    window.addEventListener('scroll', () => {
      toTop.classList.toggle('show', window.scrollY > 480);
    });
    toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  /* Accordion (About FAQ, Donate FAQ) */
  document.querySelectorAll('.accordion-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));
      if (panel) {
        panel.style.maxHeight = expanded ? '0px' : panel.scrollHeight + 'px';
      }
    });
  });

  /* Gallery filter */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-grid [data-category]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      galleryItems.forEach(item => {
        const match = filter === 'all' || item.dataset.category === filter;
        item.style.display = match ? '' : 'none';
      });
    });
  });

  /* Donate: amount selection */
  const amountBtns = document.querySelectorAll('.amount-btn');
  const customAmount = document.getElementById('customAmount');
  amountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      amountBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (customAmount) customAmount.value = btn.dataset.amount;
    });
  });
  if (customAmount) {
    customAmount.addEventListener('input', () => amountBtns.forEach(b => b.classList.remove('active')));
  }

  /* Donate: one-time vs monthly toggle */
  const donateToggleBtns = document.querySelectorAll('.donate-toggle button');
  donateToggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      donateToggleBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* Simple form intercept (no backend yet) */
  /* ── Live form submission (Brevo-backed API) ───────────── */

  // Point this at your deployed server. Leave '' to use the same
  // origin the site is served from.
  const API_BASE = window.MECF_API_BASE || '';

  const showNote = (form, message, ok) => {
    let note = form.querySelector('.form-note');
    if (!note) {
      note = document.createElement('p');
      note.className = 'form-note';
      form.appendChild(note);
    }
    note.textContent = message;
    note.style.display = 'block';
    note.style.marginTop = '1rem';
    note.style.fontWeight = '600';
    note.style.fontSize = '0.92rem';
    note.style.color = ok ? 'var(--green-700)' : 'var(--crimson-600)';
  };

  const submitForm = async (form, endpoint, payload) => {
    const btn = form.querySelector('button[type="submit"], button:not([type])');
    const original = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.7';
      btn.innerHTML = 'Sending…';
    }

    try {
      const res = await fetch(`${API_BASE}/api/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.ok) {
        showNote(form, data.message || 'Thank you — your message has been sent.', true);
        form.reset();
        // Restore any donate-form defaults after reset
        const active = form.querySelector('.amount-btn.active');
        const custom = form.querySelector('#customAmount');
        if (active && custom) custom.value = active.dataset.amount;
      } else {
        showNote(form, data.error || 'Something went wrong. Please try again.', false);
      }
    } catch (err) {
      showNote(form, 'Could not reach the server. Please check your connection and try again.', false);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.style.opacity = '';
        btn.innerHTML = original;
      }
    }
  };

  const val = (form, selector) => {
    const el = form.querySelector(selector);
    return el ? el.value.trim() : '';
  };

  // Newsletter signup — present on several pages
  document.querySelectorAll('form.newsletter-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submitForm(form, 'subscribe', {
        email: val(form, 'input[type="email"]'),
        website: val(form, 'input[name="website"]'),
      });
    });
  });

  // Contact page
  const contactForm = document.querySelector('form[data-form="contact"]');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitForm(contactForm, 'contact', {
        name: val(contactForm, '#name'),
        email: val(contactForm, '#email'),
        subject: val(contactForm, '#subject'),
        message: val(contactForm, '#message'),
        website: val(contactForm, 'input[name="website"]'),
      });
    });
  }

  // Donate page
  // Note: the amount selector and toggle live OUTSIDE the <form> element,
  // so those two are read from the document, not from the form.
  const donateForm = document.querySelector('form[data-form="donate"]');
  if (donateForm) {
    donateForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const activeToggle = document.querySelector('.donate-toggle button.active');
      const amountField = document.getElementById('customAmount');
      const activeAmountBtn = document.querySelector('.amount-btn.active');
      const amount =
        (amountField && amountField.value.trim()) ||
        (activeAmountBtn && activeAmountBtn.dataset.amount) ||
        '';

      submitForm(donateForm, 'donate', {
        name: val(donateForm, '#dname'),
        email: val(donateForm, '#demail'),
        amount,
        frequency:
          activeToggle && /monthly/i.test(activeToggle.textContent) ? 'monthly' : 'one-time',
        fund: val(donateForm, '#dfund'),
        website: val(donateForm, 'input[name="website"]'),
      });
    });
  }
});
