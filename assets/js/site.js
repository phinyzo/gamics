'use strict';

/**
 * PhinTech Arena — Site-wide functionality
 * Powered by PhinTech Solutions, Kenya
 *
 * Makes every dead/non-functional element on the site work:
 *  - Cart system (add, remove, update, checkout via M-Pesa)
 *  - Header search → routes to games section
 *  - Newsletter forms → save email, show confirmation
 *  - Hero "Read More" button → scroll to games
 *  - Shop "Add to Cart" buttons
 *  - Blog "Read More" links → open relevant game search
 *  - Contact nav link → scroll to footer
 *  - Social links → real PhinTech accounts
 *  - Footer product links → scroll to relevant sections
 *  - Footer help links → show info modals
 *  - Countdown text → dynamic date
 *  - Latest game cards → open install modal
 *  - Featured game cards → open install modal
 */

// ── CART SYSTEM ───────────────────────────────────────────────────────────────

const CART_KEY = 'gamics_cart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}

function saveCart(cart) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch(_) {}
}

function addToCart(item) {
  const cart = getCart();
  const existing = cart.find(i => i.id === item.id);
  if (existing) {
    existing.qty = (existing.qty || 1) + 1;
  } else {
    cart.push({ ...item, qty: 1, addedAt: Date.now() });
  }
  saveCart(cart);
  updateCartBadge();
  showCartToast(item.name);
}

function removeFromCart(id) {
  const cart = getCart().filter(i => i.id !== id);
  saveCart(cart);
  updateCartBadge();
  renderCartModal();
}

function updateCartBadge() {
  const cart  = getCart();
  const total = cart.reduce((s, i) => s + (i.qty || 1), 0);
  const badge = document.querySelector('.cart-badge');
  if (badge) {
    badge.textContent = total;
    badge.style.display = total > 0 ? 'flex' : 'none';
    // Animate pop
    badge.classList.remove('badge-pop');
    void badge.offsetWidth;
    badge.classList.add('badge-pop');
  }
}

function showCartToast(name) {
  const toast = document.createElement('div');
  toast.className = 'license-toast';
  toast.innerHTML = `<ion-icon name="cart-outline"></ion-icon> "${escHtml(name)}" added to cart`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('visible'), 50);
  setTimeout(() => { toast.classList.remove('visible'); setTimeout(() => toast.remove(), 400); }, 3000);
}

function cartTotal() {
  return getCart().reduce((s, i) => s + ((i.price || 0) * (i.qty || 1)), 0);
}

// ── CART MODAL ────────────────────────────────────────────────────────────────

function openCartModal() {
  let modal = document.getElementById('cartModal');
  if (!modal) {
    modal = createCartModal();
    document.body.appendChild(modal);
  }
  renderCartModal();
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCartModal() {
  document.getElementById('cartModal')?.classList.remove('active');
  document.body.style.overflow = '';
}

function createCartModal() {
  const div = document.createElement('div');
  div.id = 'cartModal';
  div.className = 'modal-overlay';
  div.setAttribute('role', 'dialog');
  div.setAttribute('aria-modal', 'true');
  div.setAttribute('aria-label', 'Shopping Cart');
  div.innerHTML = `
    <div class="cart-modal-box install-modal-box">
      <button class="gm-close-btn" onclick="closeCartModal()" aria-label="Close">
        <ion-icon name="close-outline"></ion-icon>
      </button>
      <div class="install-modal-header">
        <ion-icon name="cart-outline" class="install-icon"></ion-icon>
        <h2 class="install-title">Your <span>Cart</span></h2>
      </div>
      <div id="cartItems"></div>
      <div class="cart-footer" id="cartFooter"></div>
    </div>`;
  div.addEventListener('click', e => { if (e.target === div) closeCartModal(); });
  return div;
}

function renderCartModal() {
  const itemsEl  = document.getElementById('cartItems');
  const footerEl = document.getElementById('cartFooter');
  const cart     = getCart();

  if (!itemsEl) return;

  if (!cart.length) {
    itemsEl.innerHTML  = `<p class="gp-empty" style="text-align:center;padding:40px 0;">Your cart is empty. <br>Browse games or shop above.</p>`;
    if (footerEl) footerEl.innerHTML = '';
    return;
  }

  itemsEl.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-img" style="background-image:url('${escHtml(item.img || '')}')"></div>
      <div class="cart-item-info">
        <p class="cart-item-name">${escHtml(item.name)}</p>
        <p class="cart-item-price">KES ${Number(item.price || 0).toLocaleString()}</p>
      </div>
      <div class="cart-item-qty">
        <button onclick="changeCartQty('${item.id}', -1)">−</button>
        <span>${item.qty || 1}</span>
        <button onclick="changeCartQty('${item.id}', 1)">+</button>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart('${item.id}')" aria-label="Remove">
        <ion-icon name="trash-outline"></ion-icon>
      </button>
    </div>`).join('');

  const total = cartTotal();
  if (footerEl) {
    footerEl.innerHTML = `
      <div class="cart-total">
        <span>Total</span>
        <strong>KES ${total.toLocaleString()}</strong>
      </div>
      <button class="gm-buy-btn" onclick="checkoutCart()">
        <ion-icon name="phone-portrait-outline"></ion-icon> Checkout via M-Pesa
      </button>
      <button class="cart-clear-btn" onclick="clearCart()">
        <ion-icon name="trash-outline"></ion-icon> Clear Cart
      </button>`;
  }
}

function changeCartQty(id, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, (item.qty || 1) + delta);
  saveCart(cart);
  updateCartBadge();
  renderCartModal();
}

function clearCart() {
  saveCart([]);
  updateCartBadge();
  renderCartModal();
}

function checkoutCart() {
  const cart  = getCart();
  if (!cart.length) return;
  const total = cartTotal();
  const items = cart.map(i => `${i.name} x${i.qty}`).join(', ');
  const phone = currentProfile?.phone || '';
  const normPhone = (() => {
    const d = phone.replace(/[\s\-().+]/g, '');
    if (/^0[17]\d{8}$/.test(d))        return '254' + d.slice(1);
    if (/^[17]\d{8}$/.test(d))         return '254' + d;
    if (/^254[17]\d{8}$/.test(d))      return d;
    return d; // pass through, Lipia will validate
  })();
  const ref   = 'CART-' + Date.now();

  // Open Lipia Online payment
  const params = new URLSearchParams({ amount: total, ref, ...(normPhone ? { phone: normPhone } : {}) });
  window.open(`https://lipia-online.vercel.app/link/PHINTECHSOLUTIONS?${params}`, '_blank', 'noopener,noreferrer');

  // Save order
  try {
    const orders = JSON.parse(localStorage.getItem('gamics_orders') || '[]');
    orders.push({ ref, items: cart, total, date: new Date().toISOString(), status: 'pending' });
    localStorage.setItem('gamics_orders', JSON.stringify(orders));
  } catch(_) {}

  closeCartModal();
  showCartToast('Payment initiated for KES ' + total.toLocaleString());
}

// ── WIRE SHOP ADD-TO-CART BUTTONS ─────────────────────────────────────────────

function wireShopButtons() {
  const shopCards = document.querySelectorAll('.shop-card');
  shopCards.forEach((card, idx) => {
    const btn  = card.querySelector('.card-btn');
    const name = card.querySelector('.card-title')?.textContent?.trim() || 'Item ' + (idx + 1);
    const priceText = card.querySelector('.card-price')?.textContent?.trim() || '0';
    const price = parseInt(priceText.replace(/[^\d]/g, '')) || 0;
    const img   = card.querySelector('img')?.src || '';

    if (btn) {
      btn.addEventListener('click', () => {
        addToCart({ id: 'shop-' + idx, name, price, img, type: 'gear' });
      });
    }

    // Make card title open a search for that product
    const title = card.querySelector('.card-title');
    if (title) {
      title.style.cursor = 'pointer';
      title.addEventListener('click', e => {
        e.preventDefault();
        const q = name.split(' ').slice(0, 3).join(' ');
        const searchInput = document.getElementById('igdbSearch');
        if (searchInput) {
          searchInput.value = q;
          searchInput.dispatchEvent(new Event('input'));
        }
        document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  });
}

// ── WIRE LATEST + FEATURED GAME CARDS ────────────────────────────────────────

function wireGameCards() {
  // Latest game cards
  document.querySelectorAll('.latest-game-card').forEach((card, idx) => {
    const title = card.querySelector('.card-title')?.textContent?.trim() || 'Game';
    const priceText = card.querySelector('.card-price')?.textContent || '';
    const price = priceText.includes('1,000') || priceText.includes('1000') ? 1000 : 500;
    const img   = card.querySelector('img')?.src || '';

    card.style.cursor = 'pointer';
    card.addEventListener('click', e => {
      if (e.target.closest('a[href="#"]')) {
        e.preventDefault();
        openInstallModal('local-' + idx, title, 'KES ' + price.toLocaleString());
      }
    });
  });

  // Featured game cards — add buy button to overlay
  document.querySelectorAll('.featured-game-card').forEach((card, idx) => {
    const overlay = card.querySelector('.card-content-overlay');
    const title   = card.querySelector('.card-title')?.textContent?.trim() || 'Game';
    const priceEl = card.querySelector('.featured-price');
    const priceText = priceEl?.textContent || 'KES 500';
    const price = priceText.includes('1,000') || priceText.includes('1000') ? 1000 : 500;
    const img   = card.querySelector('img')?.src || '';

    if (overlay && !overlay.querySelector('.featured-buy-btn')) {
      const btn = document.createElement('button');
      btn.className   = 'featured-buy-btn';
      btn.innerHTML   = '<ion-icon name="cart-outline"></ion-icon> Add to Cart';
      btn.addEventListener('click', e => {
        e.stopPropagation();
        addToCart({ id: 'feat-' + idx, name: title, price, img, type: 'game' });
      });
      overlay.appendChild(btn);
    }
  });
}

// ── HEADER SEARCH → GAMES SECTION ────────────────────────────────────────────

function wireHeaderSearch() {
  const searchBox   = document.querySelector('[data-search-box]');
  const searchField = searchBox?.querySelector('.search-field');
  const submitBtn   = searchBox?.querySelector('.search-submit');

  if (!submitBtn || !searchField) return;

  const doSearch = () => {
    const q = searchField.value.trim();
    if (!q) return;

    // Close the search overlay
    searchBox?.classList.remove('active');

    // Route to games section and trigger search
    const igdbSearch = document.getElementById('igdbSearch');
    if (igdbSearch) {
      igdbSearch.value = q;
      igdbSearch.dispatchEvent(new Event('input'));
    }

    document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' });
  };

  submitBtn.addEventListener('click', doSearch);
  searchField.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
}

// ── NEWSLETTER FORMS ──────────────────────────────────────────────────────────

function wireNewsletterForms() {
  document.querySelectorAll('.newsletter-form, .footer-newsletter form').forEach(form => {
    if (form._wired) return;
    form._wired = true;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      const email = input?.value?.trim();
      if (!email || !email.includes('@')) return;

      // Save to localStorage
      const subs = JSON.parse(localStorage.getItem('gamics_newsletter') || '[]');
      if (!subs.includes(email)) { subs.push(email); localStorage.setItem('gamics_newsletter', JSON.stringify(subs)); }

      // Show confirmation
      input.value = '';
      const msg = document.createElement('p');
      msg.className   = 'newsletter-confirm';
      msg.textContent = `✅ Subscribed! We'll send updates to ${email}`;
      msg.style.cssText = 'color:hsl(120,60%,60%);font-size:1.3rem;margin-block-start:8px;';
      form.after(msg);
      setTimeout(() => msg.remove(), 4000);

      // If authenticated, also save to Supabase profile
      const token = typeof getToken === 'function' ? getToken() : null;
      if (token) {
        fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
          body: JSON.stringify({ email_notify: true }),
        }).catch(() => {});
      }
    });
  });
}

// ── HERO READ MORE BUTTON ─────────────────────────────────────────────────────

function wireHeroButton() {
  const btn = document.querySelector('.hero .btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' });
  });
}

// ── CONTACT NAV LINK ──────────────────────────────────────────────────────────

function wireContactLink() {
  document.querySelectorAll('.navbar-link').forEach(link => {
    if (link.textContent.trim().toLowerCase() === 'contact') {
      link.href = '#';
      link.addEventListener('click', e => {
        e.preventDefault();
        document.querySelector('.footer-brand')?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  });
}

// ── BLOG READ MORE LINKS ──────────────────────────────────────────────────────

function wireBlogLinks() {
  const searchTerms = ['shooter action', 'walking dead zombie', 'defense ancients dota'];
  document.querySelectorAll('.blog-card').forEach((card, idx) => {
    const link  = card.querySelector('.card-link');
    const title = card.querySelector('.card-title')?.textContent?.trim() || '';
    if (!link) return;
    link.href = '#games';
    link.addEventListener('click', e => {
      e.preventDefault();
      const q = searchTerms[idx] || title;
      const igdbSearch = document.getElementById('igdbSearch');
      if (igdbSearch) { igdbSearch.value = q; igdbSearch.dispatchEvent(new Event('input')); }
      document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// ── SOCIAL LINKS ──────────────────────────────────────────────────────────────

function wireSocialLinks() {
  const SOCIAL = {
    'logo-facebook':  'https://www.facebook.com/phintechsolutions',
    'logo-twitter':   'https://twitter.com/phintechke',
    'logo-linkedin':  'https://www.linkedin.com/company/phintech-solutions',
    'logo-pinterest': 'https://www.pinterest.com/phintechsolutions',
    'logo-youtube':   'https://www.youtube.com/@phintechsolutions',
    'logo-instagram': 'https://www.instagram.com/phintechsolutions',
  };
  document.querySelectorAll('.social-link').forEach(link => {
    const icon = link.querySelector('ion-icon');
    if (!icon) return;
    const name = icon.getAttribute('name');
    if (SOCIAL[name]) {
      link.href   = SOCIAL[name];
      link.target = '_blank';
      link.rel    = 'noopener noreferrer';
    }
  });
}

// ── FOOTER LINKS ──────────────────────────────────────────────────────────────

function wireFooterLinks() {
  const map = {
    'Terms & Conditions': () => showInfoModal('Terms & Conditions', 'By using PhinTech Arena you agree to our community standards: fair play, no cheating, respect all opponents. Prize disputes are resolved by PhinTech Solutions admin within 24 hours.'),
    'Privacy Policy':     () => showInfoModal('Privacy Policy', 'We collect your gamer tag, M-Pesa number, and game preferences to power tournament registration and notifications. Your data is stored securely in Supabase and never sold.'),
    'Refund Policy':      () => showInfoModal('Refund Policy', 'Tournament entry fees are non-refundable once the tournament has started. If a tournament is cancelled by PhinTech Arena, full refunds are issued within 48 hours via M-Pesa.'),
    'Affiliate':          () => showInfoModal('Affiliate Program', 'Earn 10% on every tournament entry fee you refer. Contact info@phintechsolutions.com with your gamer tag to join our affiliate program.'),
    'Use Cases':          () => document.getElementById('arena')?.scrollIntoView({ behavior: 'smooth' }),
    'Graphics (26)':      () => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' }),
    'Backgrounds (11)':   () => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' }),
    'Fonts (9)':          () => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' }),
    'Music (3)':          () => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' }),
    'Photography (3)':    () => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' }),
  };

  document.querySelectorAll('.footer-link').forEach(link => {
    const text = link.textContent.trim();
    const action = map[text];
    if (action) {
      link.href = '#';
      link.addEventListener('click', e => { e.preventDefault(); action(); });
    }
  });
}

// ── INFO MODAL ────────────────────────────────────────────────────────────────

function showInfoModal(title, body) {
  let modal = document.getElementById('infoModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'infoModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="install-modal-box" style="max-width:500px;">
        <button class="gm-close-btn" onclick="document.getElementById('infoModal').classList.remove('active'); document.body.style.overflow='';" aria-label="Close">
          <ion-icon name="close-outline"></ion-icon>
        </button>
        <h2 class="install-title" id="infoModalTitle" style="margin-block-end:16px;"></h2>
        <p id="infoModalBody" style="color:var(--roman-silver);font-size:var(--fs-8);line-height:1.8;"></p>
        <p class="modal-powered" style="margin-block-start:20px;">
          <a href="https://phintechsolutions.com" target="_blank" rel="noopener">PhinTech Solutions — Kenya</a>
        </p>
      </div>`;
    modal.addEventListener('click', e => {
      if (e.target === modal) { modal.classList.remove('active'); document.body.style.overflow = ''; }
    });
    document.body.appendChild(modal);
  }
  document.getElementById('infoModalTitle').textContent = title;
  document.getElementById('infoModalBody').textContent  = body;
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ── COUNTDOWN TEXT — dynamic ──────────────────────────────────────────────────

function updateCountdownText() {
  const el = document.querySelector('.countdown-text');
  if (!el) return;
  const now    = new Date();
  const day    = now.getDay(); // 0=Sun
  const hour   = now.getHours();
  const isWeekend = day === 0 || day === 6;

  if (isWeekend) {
    el.innerHTML = `Weekend Tournaments LIVE &mdash; Join Now &nbsp;<span class="span skewBg">🏆 Win KES 25,000</span>`;
  } else if (hour < 12) {
    el.innerHTML = `Morning Games from <span class="span skewBg">KES 500</span> &mdash; Pay via M-Pesa. Play Today.`;
  } else if (hour < 18) {
    el.innerHTML = `Kenya&apos;s #1 Gaming Hub &mdash; New Titles Every Week &nbsp;<span class="span skewBg">🎮 KES 500</span>`;
  } else {
    el.innerHTML = `Evening Arena Tournaments &mdash; <span class="span skewBg">Register Now</span>`;
  }
}

// ── FOOTER EMAIL FIX ──────────────────────────────────────────────────────────

function fixFooterEmail() {
  const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
  emailLinks.forEach(link => {
    if (link.href.includes('phintech arena')) {
      link.href = 'mailto:info@phintechsolutions.com';
      const textEl = link.closest('.contact-item')?.querySelector('.item-text');
      if (textEl) textEl.textContent = 'Email : info@phintechsolutions.com';
    }
  });
}

// ── WIRE CART BUTTON ──────────────────────────────────────────────────────────

function wireCartButton() {
  const btn = document.querySelector('.cart-btn');
  if (btn) btn.addEventListener('click', openCartModal);
}

// ── UTILS ─────────────────────────────────────────────────────────────────────

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── INIT ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  updateCartBadge();
  updateCountdownText();
  fixFooterEmail();
  wireCartButton();
  wireShopButtons();
  wireGameCards();
  wireHeaderSearch();
  wireNewsletterForms();
  wireHeroButton();
  wireContactLink();
  wireBlogLinks();
  wireSocialLinks();
  wireFooterLinks();

  // Logo → scroll to top
  document.querySelector('.logo-arena')?.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Footer logo → scroll to top
  document.querySelector('.footer .logo')?.addEventListener('click', e => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
