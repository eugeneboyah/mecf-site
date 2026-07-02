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
  document.querySelectorAll('form[data-demo-form]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const note = form.querySelector('.form-note');
      if (note) {
        note.textContent = 'Thank you — this form is a working demo and isn\u2019t connected to email yet.';
        note.style.display = 'block';
      }
    });
  });
});
