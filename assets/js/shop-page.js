'use strict';

/* ============================================================
   PRODUCT CATALOGUE  — sourced from saruk.co.ke
   ============================================================ */
const PRODUCTS = [
  // ── CONTROLLERS ──
  { id:'c1', name:'DualSense Edge Wireless Controller', brand:'Sony', category:'Controllers', price:12000, img:'https://saruk.co.ke/_next/DualSense Edge Wireless Controller.jpeg' },
  { id:'c2', name:'Microsoft Xbox 360 Wireless Controller', brand:'Microsoft', category:'Controllers', price:12000, img:'https://saruk.co.ke/_next/Microsoft XBOX 360 Wireless Controller.jpeg' },
  { id:'c3', name:'PS5 DualSense Wireless Controller', brand:'Sony', category:'Controllers', price:9500, img:'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=400&h=300&fit=crop' },
  { id:'c4', name:'Xbox Series X Controller Carbon Black', brand:'Microsoft', category:'Controllers', price:8500, img:'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=400&h=300&fit=crop' },

  // ── GAMES ──
  { id:'g1', name:'EA SPORTS FC 26 PS5', brand:'EA Sports', category:'Games', price:12000, img:'https://saruk.co.ke/_next/EA SPORTS FC 26 PS5.jpeg' },
  { id:'g2', name:'EA Sports F1 24 PS5', brand:'EA Sports', category:'Games', price:12000, img:'https://saruk.co.ke/_next/EA Sports F1 24 -PS5-.jpeg' },
  { id:'g3', name:'EA Sports FC 25 PS5', brand:'EA Sports', category:'Games', price:12000, img:'https://saruk.co.ke/_next/EA-Sports-FC-25-PS5d5f1.jpeg' },
  { id:'g4', name:'NFS Unbound PS5', brand:'EA', category:'Games', price:12000, img:'https://saruk.co.ke/_next/NFS UNBOUND for PS5.jpeg' },
  { id:'g5', name:'Call of Duty Modern Warfare III', brand:'Activision', category:'Games', price:9000, img:'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400&h=300&fit=crop' },
  { id:'g6', name:'Cyberpunk 2077 PC', brand:'CD Projekt', category:'Games', price:4500, img:'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=400&h=300&fit=crop' },

  // ── HEADSETS ──
  { id:'h1', name:'JBL Quantum 100M2 Wired Gaming Headset', brand:'JBL', category:'Headset', price:5500, img:'https://saruk.co.ke/_next/JBL Quantum 100M2 Wired Over-Ear Gaming Headphones.jpeg' },
  { id:'h2', name:'JBL Quantum 350 Wireless Gaming Headset', brand:'JBL', category:'Headset', price:12000, img:'https://saruk.co.ke/_next/JBL Quantum 350 Wireless Gaming Headset.jpeg' },
  { id:'h3', name:'Bose QuietComfort Ultra Headphones 2nd Gen', brand:'Bose', category:'Headset', price:55000, img:'https://saruk.co.ke/_next/Bose QuietComfort Ultra Headphones -2nd Gen-.jpeg' },
  { id:'h4', name:'Razer BlackShark V2 X Gaming Headset', brand:'Razer', category:'Headset', price:9800, img:'https://images.unsplash.com/photo-1599669454699-248893623440?w=400&h=300&fit=crop' },
  { id:'h5', name:'HyperX Cloud Alpha Wireless', brand:'HyperX', category:'Headset', price:14500, img:'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=300&fit=crop' },
  { id:'h6', name:'ATeam Studio KX-60 Wireless Headphones', brand:'ATeam', category:'Headset', price:12000, img:'https://saruk.co.ke/_next/ATeam Studio KX-60 Wireless Headphones.jpeg' },
  { id:'h7', name:'Amplify Stellar Bluetooth Headphones', brand:'Amplify', category:'Headset', price:12000, img:'https://saruk.co.ke/_next/Amplify Stellar Series Bluetooth Headphones AM-2014-BK.jpeg' },

  // ── MONITORS ──
  { id:'m1', name:'LG 34" Curved UltraWide WQHD Monitor 100Hz', brand:'LG', category:'Monitor', price:45000, img:'https://saruk.co.ke/_next/1776841040731-lg-34-curved-ultrawide-wqhd-3440-x-1440-monitor-ips-display-panel-3800r-curvature-100-hz-refresh-rate8c2b.jpeg' },
  { id:'m2', name:'LG 34" Curved Gaming UltraGear QHD 160Hz', brand:'LG', category:'Monitor', price:45000, img:'https://saruk.co.ke/_next/1776841613268-lg-34-curved-gaming-monitor-ultragear-qhd-3440-x-1440-monitor-ips-display-panel-1800r-curvature-160-hz-refresh-rate-34g600af455.jpeg' },
  { id:'m3', name:'ThinkVision G27c-30 27" Gaming Monitor', brand:'Lenovo', category:'Monitor', price:12000, img:'https://saruk.co.ke/_next/05_ThinkVision_G27c-30_Front_Normal_Position_s_20220704055452913fccc.png' },
  { id:'m4', name:'Samsung 27" Odyssey G5 144Hz Gaming Monitor', brand:'Samsung', category:'Monitor', price:38000, img:'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=400&h=300&fit=crop' },

  // ── VR ──
  { id:'v1', name:'Meta Quest 3 256GB Mixed Reality VR Headset', brand:'Meta', category:'VR', price:85000, img:'https://saruk.co.ke/_next/Meta Quest 3 256GB New Mixed Reality VR Headset.jpeg' },
  { id:'v2', name:'Meta Quest 3S', brand:'Meta', category:'VR', price:65000, img:'https://saruk.co.ke/_next/Meta-Quest-3S -1-.jpeg' },
  { id:'v3', name:'Oculus Meta Quest 3 512GB Advanced All-in-One VR', brand:'Meta', category:'VR', price:85000, img:'https://saruk.co.ke/_next/Oculus Meta Quest 3 512GB Advanced All-in-One VR Headset.jpeg' },

  // ── KEYBOARDS ──
  { id:'k1', name:'Redragon K552 Kumara Mechanical RGB Keyboard', brand:'Redragon', category:'Keyboard', price:6200, img:'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=300&fit=crop' },
  { id:'k2', name:'Logitech G Pro X TKL Gaming Keyboard', brand:'Logitech', category:'Keyboard', price:12000, img:'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=400&h=300&fit=crop' },
  { id:'k3', name:'HyperX Alloy Origins Core TKL Mechanical', brand:'HyperX', category:'Keyboard', price:9500, img:'https://images.unsplash.com/photo-1595044426077-d36d9236d54a?w=400&h=300&fit=crop' },

  // ── MICE ──
  { id:'ms1', name:'Logitech G502 Hero High-Performance Gaming Mouse', brand:'Logitech', category:'Mouse', price:7500, img:'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=400&h=300&fit=crop' },
  { id:'ms2', name:'Razer DeathAdder V3 Pro Wireless', brand:'Razer', category:'Mouse', price:11000, img:'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=400&h=300&fit=crop' },
  { id:'ms3', name:'SteelSeries Rival 650 Wireless Gaming Mouse', brand:'SteelSeries', category:'Mouse', price:8500, img:'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=300&fit=crop' },
  { id:'ms4', name:'XL RGB Gaming Mousepad Desk Mat', brand:'Generic', category:'Mouse', price:2800, img:'https://images.unsplash.com/photo-1616588589676-62b3bd4ff6d2?w=400&h=300&fit=crop' },

  // ── CHAIRS ──
  { id:'ch1', name:'Pro Racing Gaming Chair — Ergonomic', brand:'Generic', category:'Chair', price:22000, img:'https://images.unsplash.com/photo-1598550476439-6847785fcea6?w=400&h=300&fit=crop' },
  { id:'ch2', name:'Secretlab Titan Evo 2022 Gaming Chair', brand:'Secretlab', category:'Chair', price:55000, img:'https://images.unsplash.com/photo-1631157769375-c52d65d98069?w=400&h=300&fit=crop' },
  { id:'ch3', name:'DXRacer Formula Series Gaming Chair', brand:'DXRacer', category:'Chair', price:28000, img:'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=400&h=300&fit=crop' },

  // ── SMARTWATCHES ──
  { id:'sw1', name:'Amazfit Active 2 Premium Smartwatch 44mm', brand:'Amazfit', category:'Smartwatch', price:12500, img:'https://saruk.co.ke/_next/1776954497649-amazfit-active-2-premium-smart-watch-fitness-tracker-44mm9a4e.jpeg' },
  { id:'sw2', name:'Amazfit Active Edge Smart Watch 46mm', brand:'Amazfit', category:'Smartwatch', price:12500, img:'https://saruk.co.ke/_next/Amazfit Active Edge Smart Watch 46 mm.jpeg' },
  { id:'sw3', name:'Amazfit GTS 2 Smartwatch', brand:'Amazfit', category:'Smartwatch', price:12000, img:'https://saruk.co.ke/_next/Amazfit GTS 2 Smartwatch.jpeg' },
  { id:'sw4', name:'Havit M9031 Pro AMOLED Bluetooth Smartwatch', brand:'Havit', category:'Smartwatch', price:28000, img:'https://saruk.co.ke/_next/1777969834084-havit-m9031-pro-1-43-amoled-300mah-smartwatch-bluetooth-calling-fitness-smart-watch-with-ip68-waterproof-and-health-monitoringeb02.jpeg' },
  { id:'sw5', name:'Amazfit T-Rex 3 Pro 44mm Sapphire AMOLED Adventure Watch', brand:'Amazfit', category:'Smartwatch', price:22000, img:'https://saruk.co.ke/_next/1776955618109-amazfit-t-rex-3-pro-44mm-1-32-sapphire-amoled-display-ti-bezel-adventure-and-fitness-tracking-wireless-bluetooth-smartwatch-10-atm-180-sports-modec07d.jpeg' },

  // ── STORAGE ──
  { id:'st1', name:'HIKSEMI Pocket 512GB Portable SSD', brand:'HIKSEMI', category:'Storage', price:12000, img:'https://saruk.co.ke/_next/HIKSEMI HS-ESSD-T100 POCKET 512GB PORTABLE SSD.jpeg' },
  { id:'st2', name:'Samsung 1TB T7 Portable SSD', brand:'Samsung', category:'Storage', price:14500, img:'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=400&h=300&fit=crop' },
  { id:'st3', name:'WD 2TB My Passport External Hard Drive', brand:'WD', category:'Storage', price:8500, img:'https://images.unsplash.com/photo-1603816245457-c9e9ed9f0be6?w=400&h=300&fit=crop' },
  { id:'st4', name:'Kingston 256GB NVMe M.2 SSD 3500MB/s', brand:'Kingston', category:'Storage', price:6500, img:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop' },

  // ── CONSOLES ──
  { id:'cn1', name:'Nintendo Switch Lite', brand:'Nintendo', category:'Console', price:38000, img:'https://saruk.co.ke/_next/Nintendo Switch Lite.jpeg' },
  { id:'cn2', name:'Nintendo Switch Fortnite Edition', brand:'Nintendo', category:'Console', price:38000, img:'https://saruk.co.ke/_next/Nintendo Switch Fortnite Edition.jpeg' },
  { id:'cn3', name:'MSI Gaming Desktop i9 RTX 5070 32GB 1TB', brand:'MSI', category:'Console', price:285000, img:'https://saruk.co.ke/_next/1776761563820-msi-ai-gaming-desktop-pc-intel-core-i9-14900kf-32gb-ram-1tb-ssd-12gb-geforce-rtx-5070-graphics-air-cooling-windows-11-home-cpu-only2dc7.jpeg' },

  // ── AUDIO ──
  { id:'a1', name:'JBL Free WFH Wireless Headset', brand:'JBL', category:'Audio', price:12000, img:'https://saruk.co.ke/_next/JBL Free WFH Wireless.jpeg' },
  { id:'a2', name:'Oraimo SpaceBuds 2 Hybrid ANC True Wireless Earbuds', brand:'Oraimo', category:'Audio', price:28000, img:'https://saruk.co.ke/_next/1777967754042-oraimo-spacebuds-2-otw-631-hybrid-anc-true-wireless-earbuds-customized-voice-prompt18d7.jpeg' },
  { id:'a3', name:'OnePlus Buds 4 AI Triple Mic Noise Reduction', brand:'OnePlus', category:'Audio', price:28000, img:'https://saruk.co.ke/_next/1777969137702-oneplus-buds-4-ai-powered-triple-mic-call-noise-reductionfb22.jpeg' },
  { id:'a4', name:'JBL JR460NC Wireless Kids Headphones', brand:'JBL', category:'Audio', price:12000, img:'https://saruk.co.ke/_next/JBL JR460NC Wireless Kids Headphones.jpeg' },

  // ── APPAREL ──
  { id:'ap1', name:'Gaming Women Black T-Shirt', brand:'PhinTech', category:'Apparel', price:3500, img:'./assets/images/shop-img-1.jpg' },
  { id:'ap2', name:'Esports Hoodie — Black & Gold', brand:'PhinTech', category:'Apparel', price:5500, img:'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400&h=300&fit=crop' },
  { id:'ap3', name:'Gamer Cap — Embroidered Logo', brand:'PhinTech', category:'Apparel', price:2500, img:'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&h=300&fit=crop' },
];

/* ============================================================
   CART STATE
   ============================================================ */
let cart = JSON.parse(localStorage.getItem('phintech_cart') || '[]');

function saveCart() { localStorage.setItem('phintech_cart', JSON.stringify(cart)); }

function getTotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }

function fmt(n) { return 'KES ' + n.toLocaleString('en-KE'); }

function updateBadges() {
  const count = cart.reduce((s, i) => s + i.qty, 0);
  document.querySelectorAll('#shopCartBadge, .cart-badge').forEach(el => el.textContent = count);
}

/* ============================================================
   RENDER CART DRAWER
   ============================================================ */
function renderCart() {
  const list = document.getElementById('spCartItems');
  const total = document.getElementById('spCartTotal');
  if (!list) return;

  if (!cart.length) {
    list.innerHTML = '<p class="sp-cart-empty-msg"><ion-icon name="cart-outline"></ion-icon><br>Your cart is empty</p>';
    total.textContent = 'KES 0';
    updateBadges();
    return;
  }

  list.innerHTML = cart.map(item => `
    <div class="sp-cart-item" data-id="${item.id}">
      <img src="${item.img}" alt="${item.name}" class="sp-cart-item-img" onerror="this.src='https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=60&h=50&fit=crop'">
      <div class="sp-cart-item-info">
        <p class="sp-cart-item-name">${item.name}</p>
        <p class="sp-cart-item-price">${fmt(item.price)}</p>
        <div class="sp-cart-item-controls">
          <button class="sp-qty-btn" data-action="dec" data-id="${item.id}">−</button>
          <span class="sp-qty-val">${item.qty}</span>
          <button class="sp-qty-btn" data-action="inc" data-id="${item.id}">+</button>
          <button class="sp-remove-btn" data-action="remove" data-id="${item.id}" aria-label="Remove"><ion-icon name="trash-outline"></ion-icon></button>
        </div>
      </div>
    </div>
  `).join('');

  total.textContent = fmt(getTotal());
  updateBadges();
}

/* ============================================================
   CART ACTIONS
   ============================================================ */
function addToCart(id) {
  const p = PRODUCTS.find(x => x.id === id);
  if (!p) return;
  const existing = cart.find(x => x.id === id);
  if (existing) { existing.qty++; }
  else { cart.push({ ...p, qty: 1 }); }
  saveCart();
  renderCart();

  // Visual feedback on button
  const btn = document.querySelector(`[data-add="${id}"]`);
  if (btn) {
    btn.classList.add('added');
    btn.innerHTML = '<ion-icon name="checkmark-outline"></ion-icon> Added';
    setTimeout(() => {
      btn.classList.remove('added');
      btn.innerHTML = '<ion-icon name="cart-outline"></ion-icon> Add';
    }, 1400);
  }
  openCart();
}

function openCart() {
  document.getElementById('spCartDrawer').classList.add('open');
  document.getElementById('spCartOverlay').classList.add('open');
}

function closeCart() {
  document.getElementById('spCartDrawer').classList.remove('open');
  document.getElementById('spCartOverlay').classList.remove('open');
}

/* ============================================================
   RENDER PRODUCTS
   ============================================================ */
let currentCat = 'all';
let currentSearch = '';
let currentSort = 'default';

function filteredProducts() {
  let list = PRODUCTS.slice();
  if (currentCat !== 'all') list = list.filter(p => p.category === currentCat);
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    list = list.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  }
  if (currentSort === 'low') list.sort((a, b) => a.price - b.price);
  else if (currentSort === 'high') list.sort((a, b) => b.price - a.price);
  else if (currentSort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function renderProducts() {
  const grid = document.getElementById('spGrid');
  const empty = document.getElementById('spEmpty');
  const count = document.getElementById('spResultsCount');
  if (!grid) return;

  const list = filteredProducts();
  count.textContent = `Showing ${list.length} product${list.length !== 1 ? 's' : ''}`;

  if (!list.length) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = list.map(p => `
    <li>
      <div class="sp-card">
        <div class="sp-card-img-wrap">
          <img src="${p.img}" alt="${p.name}" loading="lazy"
               onerror="this.src='https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&h=300&fit=crop'">
          <span class="sp-card-badge">${p.category}</span>
        </div>
        <div class="sp-card-body">
          <p class="sp-card-name">${p.name}</p>
          <p class="sp-card-brand">${p.brand}</p>
          <div class="sp-card-footer">
            <span class="sp-card-price">${fmt(p.price)}</span>
            <button class="sp-card-add" data-add="${p.id}" onclick="addToCart('${p.id}')" aria-label="Add ${p.name} to cart">
              <ion-icon name="cart-outline"></ion-icon> Add
            </button>
          </div>
        </div>
      </div>
    </li>
  `).join('');
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  renderProducts();
  renderCart();

  // Category chips
  document.getElementById('spCats').addEventListener('click', e => {
    const btn = e.target.closest('.sp-cat-btn');
    if (!btn) return;
    document.querySelectorAll('.sp-cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCat = btn.dataset.cat;
    renderProducts();
  });

  // Search
  let searchTimer;
  document.getElementById('spSearch').addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentSearch = e.target.value.trim();
      renderProducts();
    }, 280);
  });

  // Sort
  document.getElementById('spSort').addEventListener('change', e => {
    currentSort = e.target.value;
    renderProducts();
  });

  // Cart open
  document.getElementById('shopCartBtn').addEventListener('click', openCart);

  // Cart close
  document.getElementById('spCartClose').addEventListener('click', closeCart);
  document.getElementById('spCartOverlay').addEventListener('click', closeCart);

  // Cart item actions (qty / remove)
  document.getElementById('spCartItems').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const item = cart.find(x => x.id === id);
    if (!item) return;

    if (action === 'inc') { item.qty++; }
    else if (action === 'dec') { item.qty > 1 ? item.qty-- : cart.splice(cart.indexOf(item), 1); }
    else if (action === 'remove') { cart.splice(cart.indexOf(item), 1); }

    saveCart();
    renderCart();
  });

  // Clear cart
  document.getElementById('spCartClear').addEventListener('click', () => {
    cart = [];
    saveCart();
    renderCart();
  });

  // Checkout / Mpesa modal
  document.getElementById('spCheckoutBtn').addEventListener('click', () => {
    if (!cart.length) return;
    const total = getTotal();
    document.getElementById('spMpesaAmount').textContent = fmt(total);
    document.getElementById('spMpesaAmt2').textContent = fmt(total);
    document.getElementById('spMpesaSub').textContent = `${cart.reduce((s,i)=>s+i.qty,0)} item(s) · ${fmt(total)}`;
    document.getElementById('spMpesaOverlay').style.display = 'flex';
    closeCart();
  });

  document.getElementById('spMpesaClose').addEventListener('click', () => {
    document.getElementById('spMpesaOverlay').style.display = 'none';
  });
  document.getElementById('spMpesaOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('spMpesaOverlay'))
      document.getElementById('spMpesaOverlay').style.display = 'none';
  });

  // Mobile nav toggle
  const navToggler = document.querySelector('[data-nav-toggler]');
  const navbar = document.querySelector('[data-navbar]');
  if (navToggler && navbar) {
    navToggler.addEventListener('click', () => navbar.classList.toggle('active'));
  }

  // Sticky header
  const header = document.querySelector('[data-header]');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('active', window.scrollY > 100);
    });
  }
});
