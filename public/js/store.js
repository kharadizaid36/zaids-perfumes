/**
 * ZAID'S PERFUMES - Core Storefront & Cart Engine (Shopify-inspired animation suite)
 */

const Store = {
  cart: [],
  products: [],
  activeCategory: 'All',
  searchQuery: '',
  activeCoupon: null,
  settings: {},

  init() {
    this.loadCart();
    this.fetchSettings();
    this.fetchProducts();
    this.updateCartUI();
    this.setupEventListeners();
  },

  loadCart() {
    try {
      const saved = localStorage.getItem('zp_cart');
      this.cart = saved ? JSON.parse(saved) : [];
      const savedCoupon = localStorage.getItem('zp_coupon');
      if (savedCoupon) this.activeCoupon = JSON.parse(savedCoupon);
    } catch (e) {
      this.cart = [];
    }
  },

  saveCart() {
    localStorage.setItem('zp_cart', JSON.stringify(this.cart));
    if (this.activeCoupon) {
      localStorage.setItem('zp_coupon', JSON.stringify(this.activeCoupon));
    } else {
      localStorage.removeItem('zp_coupon');
    }
    this.updateCartUI();
  },

  async fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      if (data.success && data.settings) {
        this.settings = data.settings;

        // 1. Announcement bar
        const banner = document.getElementById('announcement-text');
        if (banner && data.settings.announcementText) {
          banner.textContent = data.settings.announcementText;
        }

        // 2. Customer Care Email
        const footerEmail = document.getElementById('footer-email');
        if (footerEmail && data.settings.email) {
          footerEmail.textContent = data.settings.email;
        }
        const footerEmailLink = document.getElementById('footer-email-link');
        if (footerEmailLink && data.settings.email) {
          footerEmailLink.href = `mailto:${data.settings.email}`;
        }

        // 3. Customer Care Phone
        const footerPhone = document.getElementById('footer-phone');
        if (footerPhone && data.settings.phone) {
          footerPhone.textContent = data.settings.phone;
        }
        const footerPhoneLink = document.getElementById('footer-phone-link');
        if (footerPhoneLink && data.settings.phone) {
          const cleanPhone = data.settings.phone.replace(/[^0-9+]/g, '');
          footerPhoneLink.href = `tel:${cleanPhone}`;
        }

        // 4. Customer Care Studio Address
        const footerAddress = document.getElementById('footer-address');
        if (footerAddress && data.settings.address) {
          footerAddress.textContent = data.settings.address;
        }
      }
    } catch (e) {
      console.warn('Using default settings', e);
    }
  },

  async fetchProducts() {
    try {
      let url = '/api/products';
      const params = new URLSearchParams();
      if (this.activeCategory && this.activeCategory !== 'All' && this.activeCategory !== 'All Scents') {
        params.append('category', this.activeCategory);
      }
      if (this.searchQuery) {
        params.append('search', this.searchQuery);
      }
      const fullUrl = params.toString() ? `${url}?${params.toString()}` : url;

      const res = await fetch(fullUrl);
      const data = await res.json();
      if (data.success) {
        this.products = data.products || [];
        this.renderProductGrid();
      }
    } catch (e) {
      console.error('Error loading products:', e);
    }
  },

  renderProductGrid() {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (this.products.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full text-center py-16 text-gray-500">
          <p class="text-base font-bold text-gray-800">No fragrances found in this category.</p>
          <button onclick="Store.setCategory('All')" class="mt-4 px-5 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold shadow-md">View Entire Collection</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.products.map(p => {
      const discountPercent = p.comparePrice ? Math.round(((p.comparePrice - p.price) / p.comparePrice) * 100) : 0;
      return `
        <div class="product-card bg-white rounded-xl sm:rounded-2xl p-2 sm:p-3.5 border border-gray-200/90 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group relative overflow-hidden">
          ${p.badge ? `
            <div class="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-10">
              <span class="text-[7px] sm:text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-900 text-white shadow-sm">${p.badge}</span>
            </div>
          ` : ''}

          <!-- Visual Tin / Perfume Graphic with Zoom -->
          <a href="/product.html?id=${p.id}" class="product-image-container w-full h-24 sm:h-44 md:h-48 rounded-lg sm:rounded-xl bg-gradient-to-b from-gray-50 to-gray-100/80 border border-gray-100 flex flex-col items-center justify-center relative p-1 sm:p-2 group-hover:scale-[1.02] transition-transform cursor-pointer overflow-hidden">
            ${p.image ? `
              <img src="${p.image}" alt="${p.title}" class="w-full h-20 sm:h-36 md:h-40 object-contain drop-shadow-sm group-hover:scale-105 transition-transform duration-500" loading="lazy" onerror="if(this.src!=='${p.localImage || ''}' && '${p.localImage || ''}'){this.src='${p.localImage || ''}';}else{this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';}">
              <div class="perfume-graphic w-16 h-16 sm:w-28 sm:h-28 rounded-full border border-gray-300 bg-white hidden flex-col items-center justify-center shadow-md">
                <span class="text-[7px] text-gray-400 uppercase tracking-widest font-mono">SOLID</span>
                <span class="text-[9px] sm:text-xs font-bold text-gray-900 text-center px-1 leading-tight">${p.title.split(' ')[0]}</span>
                <span class="text-[8px] sm:text-[9px] font-bold text-blue-600">${p.title.split(' ')[1] || 'PERFUME'}</span>
              </div>
            ` : `
              <div class="perfume-graphic w-16 h-16 sm:w-28 sm:h-28 rounded-full border border-gray-300 bg-white flex flex-col items-center justify-center shadow-md">
                <span class="text-[7px] text-gray-400 uppercase tracking-widest font-mono">SOLID</span>
                <span class="text-[9px] sm:text-xs font-bold text-gray-900 text-center px-1 leading-tight">${p.title.split(' ')[0]}</span>
                <span class="text-[8px] sm:text-[9px] font-bold text-blue-600">${p.title.split(' ')[1] || 'PERFUME'}</span>
              </div>
            `}
            <span class="hidden sm:inline-block absolute bottom-1.5 text-[9px] text-gray-600 font-mono tracking-tight bg-white/95 px-2 py-0.5 rounded-full border border-gray-200 backdrop-blur-sm">${p.weight || '18g'} &bull; ${p.category}</span>
          </a>

          <!-- Details -->
          <div class="mt-1.5 sm:mt-2.5 flex-1 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between text-[8px] sm:text-xs text-amber-500 font-semibold">
                <span>★ 5.0 <span class="text-gray-400 font-normal">(${p.reviewCount || 40})</span></span>
                <span class="hidden sm:inline text-gray-500 font-mono text-[10px]">${p.longevity || '8+ Hours'}</span>
              </div>

              <a href="/product.html?id=${p.id}" class="block mt-0.5 sm:mt-1">
                <h3 class="text-[11px] sm:text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1 leading-snug">
                  ${p.title}
                </h3>
              </a>

              <p class="hidden sm:block text-[11px] text-gray-500 line-clamp-1 leading-relaxed mt-0.5">
                ${p.subtitle || p.description}
              </p>
            </div>

            <div class="flex items-baseline gap-1 sm:gap-2 pt-1 sm:pt-2">
              <span class="text-xs sm:text-base font-extrabold text-gray-900">₹${p.price}</span>
              ${p.comparePrice ? `<span class="text-[9px] sm:text-xs text-gray-400 line-through font-mono">₹${p.comparePrice}</span>` : ''}
              ${discountPercent > 0 ? `<span class="hidden sm:inline text-[10px] text-emerald-600 font-bold font-mono">${discountPercent}% OFF</span>` : ''}
            </div>
          </div>

          <!-- Action buttons with Fly To Cart Trigger -->
          <div class="mt-1.5 sm:mt-2.5 pt-1.5 sm:pt-2 border-t border-gray-100 flex items-center gap-1.5">
            <button onclick="Store.addToCartWithAnimation('${p.id}', event)" class="add-to-cart-btn flex-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-[10px] sm:text-xs uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm transition-all active:scale-95">
              <svg class="w-3 h-3 hidden sm:inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              <span>+ Add</span>
            </button>
            <button onclick="Store.openQuickView('${p.id}')" class="hidden sm:flex p-2 rounded-xl bg-gray-100 border border-gray-200 hover:border-gray-400 text-gray-700 hover:text-black transition-colors" title="Quick View">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  setCategory(cat) {
    this.activeCategory = cat;
    
    document.querySelectorAll('.cat-tab-btn').forEach(btn => {
      if (btn.dataset.category === cat) {
        btn.className = "cat-tab-btn px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gray-900 text-white font-bold text-xs uppercase tracking-wider shadow-sm transition-all whitespace-nowrap";
      } else {
        btn.className = "cat-tab-btn px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:border-gray-400 text-xs uppercase tracking-wider transition-all whitespace-nowrap";
      }
    });

    this.fetchProducts();
  },

  handleSearch(query) {
    this.searchQuery = query;
    this.fetchProducts();
  },

  // SHOPIFY-STYLE FLY-TO-CART ANIMATION
  addToCartWithAnimation(productId, event) {
    // 1. Add to cart data
    this.addToCart(productId, 1, false);

    // 2. Compute coordinates for flying orb
    const targetCart = document.getElementById('cart-btn-nav') || document.getElementById('cart-badge-count');
    if (!targetCart || !event) {
      this.openCart();
      return;
    }

    const btnRect = event.currentTarget.getBoundingClientRect();
    const cartRect = targetCart.getBoundingClientRect();

    // Create flying particle
    const orb = document.createElement('div');
    orb.className = 'flying-cart-orb';
    orb.style.left = `${btnRect.left + btnRect.width / 2 - 16}px`;
    orb.style.top = `${btnRect.top + btnRect.height / 2 - 16}px`;
    document.body.appendChild(orb);

    // Trigger animation via timeout
    setTimeout(() => {
      orb.style.left = `${cartRect.left + cartRect.width / 2 - 16}px`;
      orb.style.top = `${cartRect.top + cartRect.height / 2 - 16}px`;
      orb.style.transform = 'scale(0.3) rotate(360deg)';
      orb.style.opacity = '0.7';
    }, 20);

    // On arrival
    setTimeout(() => {
      orb.remove();
      targetCart.classList.add('animate-cart-bounce');
      setTimeout(() => targetCart.classList.remove('animate-cart-bounce'), 600);
      this.openCart();
    }, 780);
  },

  addToCart(productId, quantity = 1, shouldOpenDrawer = true) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const existingIndex = this.cart.findIndex(item => item.productId === productId);
    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += quantity;
    } else {
      this.cart.push({
        productId: product.id,
        title: product.title,
        price: product.price,
        image: product.image,
        weight: product.weight || '25g',
        quantity: quantity
      });
    }

    this.saveCart();
    this.showToast(`✨ Added "${product.title}" to Bag!`);
    if (shouldOpenDrawer) {
      this.openCart();
    }
  },

  updateQuantity(productId, delta) {
    const item = this.cart.find(i => i.productId === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.cart = this.cart.filter(i => i.productId !== productId);
    }
    this.saveCart();
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(i => i.productId !== productId);
    this.saveCart();
  },

  getCartSubtotal() {
    return this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  getCartDiscount() {
    if (!this.activeCoupon) return 0;
    const subtotal = this.getCartSubtotal();
    if (this.activeCoupon.minOrder && subtotal < this.activeCoupon.minOrder) return 0;
    
    if (this.activeCoupon.discountType === 'percentage') {
      return Math.round((subtotal * this.activeCoupon.discountValue) / 100);
    }
    return Math.min(subtotal, this.activeCoupon.discountValue);
  },

  getCartTotal() {
    return Math.max(0, this.getCartSubtotal() - this.getCartDiscount());
  },

  async applyCoupon(code) {
    if (!code) return;
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, cartTotal: this.getCartSubtotal() })
      });
      const data = await res.json();
      if (data.success) {
        this.activeCoupon = data.coupon;
        this.saveCart();
        this.showToast(`🎉 ${data.message}`);
      } else {
        this.showToast(`❌ ${data.message}`, true);
      }
    } catch (e) {
      this.showToast('❌ Failed to validate coupon', true);
    }
  },

  removeCoupon() {
    this.activeCoupon = null;
    this.saveCart();
    this.showToast('Coupon removed');
  },

  updateCartUI() {
    const cartCountEl = document.getElementById('cart-badge-count');
    const totalItems = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCountEl) {
      cartCountEl.textContent = totalItems;
      cartCountEl.classList.toggle('hidden', totalItems === 0);
    }

    const cartItemsContainer = document.getElementById('cart-drawer-items');
    if (!cartItemsContainer) return;

    const subtotal = this.getCartSubtotal();
    const discount = this.getCartDiscount();
    const total = this.getCartTotal();

    const threshold = this.settings.freeShippingThreshold || 499;
    const progressPercent = Math.min(100, Math.round((subtotal / threshold) * 100));
    const freeShipMeter = document.getElementById('free-ship-meter');
    const freeShipText = document.getElementById('free-ship-text');
    if (freeShipMeter && freeShipText) {
      freeShipMeter.style.width = `${progressPercent}%`;
      if (progressPercent >= 100) {
        freeShipText.innerHTML = `🎉 You unlocked <strong>FREE Express Delivery</strong>!`;
      } else {
        freeShipText.innerHTML = `Add <strong>₹${threshold - subtotal}</strong> more for <strong>FREE Express Delivery</strong>!`;
      }
    }

    if (this.cart.length === 0) {
      cartItemsContainer.innerHTML = `
        <div class="text-center py-16 space-y-3">
          <div class="w-16 h-16 mx-auto rounded-full bg-[#181824] border border-[#C5A059]/30 flex items-center justify-center text-2xl">
            🛍️
          </div>
          <p class="text-sm font-serif-luxury text-gray-300">Your luxury bag is empty</p>
          <p class="text-xs text-gray-500">Discover pocket-friendly solid perfumes that stay all day.</p>
        </div>
      `;
      document.getElementById('cart-checkout-btn')?.setAttribute('disabled', 'true');
    } else {
      cartItemsContainer.innerHTML = this.cart.map(item => `
        <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-lg bg-white border border-gray-200 p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
              ${item.image ? `
                <img src="${item.image}" alt="${item.title}" class="w-full h-full object-contain" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
                <span class="font-bold text-xs text-gray-900 hidden">Z</span>
              ` : `
                <span class="font-bold text-xs text-gray-900">Z</span>
              `}
            </div>
            <div>
              <p class="text-xs font-bold text-gray-900 line-clamp-1">${item.title}</p>
              <p class="text-[11px] text-gray-500 font-mono">${item.weight} &bull; ₹${item.price} each</p>
              <div class="flex items-center gap-1.5 mt-1.5">
                <button onclick="Store.updateQuantity('${item.productId}', -1)" class="w-5 h-5 rounded bg-white border border-gray-300 text-xs flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold">-</button>
                <span class="text-xs font-bold text-gray-900 px-1 font-mono">${item.quantity}</span>
                <button onclick="Store.updateQuantity('${item.productId}', 1)" class="w-5 h-5 rounded bg-white border border-gray-300 text-xs flex items-center justify-center text-gray-700 hover:bg-gray-100 font-bold">+</button>
              </div>
            </div>
          </div>
          <div class="text-right space-y-1">
            <p class="text-xs font-extrabold text-gray-900">₹${item.price * item.quantity}</p>
            <button onclick="Store.removeFromCart('${item.productId}')" class="text-[10px] text-red-500 hover:underline">Remove</button>
          </div>
        </div>
      `).join('');
      document.getElementById('cart-checkout-btn')?.removeAttribute('disabled');
    }

    const subtotalEl = document.getElementById('cart-subtotal');
    const discountEl = document.getElementById('cart-discount');
    const totalEl = document.getElementById('cart-total');
    if (subtotalEl) subtotalEl.textContent = `₹${subtotal}`;
    if (discountEl) discountEl.textContent = discount > 0 ? `-₹${discount}` : '₹0';
    if (totalEl) totalEl.textContent = `₹${total}`;
  },

  openQuickView(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const modal = document.getElementById('quick-view-modal');
    const content = document.getElementById('quick-view-content');
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
        <div class="h-64 rounded-2xl bg-gray-50 border border-gray-200 flex flex-col items-center justify-center p-4 relative overflow-hidden">
          ${product.image ? `
            <img src="${product.image}" alt="${product.title}" class="w-full h-48 object-contain drop-shadow-sm" onerror="if(this.src!=='${product.localImage || ''}' && '${product.localImage || ''}'){this.src='${product.localImage || ''}';}else{this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';}">
            <div class="w-32 h-32 rounded-full border-2 border-gray-300 bg-white hidden flex-col items-center justify-center shadow-md">
              <span class="text-[9px] text-gray-400 uppercase tracking-widest font-mono">SOLID</span>
              <span class="text-sm font-bold text-gray-900 text-center px-1">${product.title.split(' ')[0]}</span>
              <span class="text-xs font-bold text-blue-600">${product.title.split(' ')[1] || ''}</span>
            </div>
          ` : `
            <div class="w-32 h-32 rounded-full border-2 border-gray-300 bg-white flex flex-col items-center justify-center shadow-md">
              <span class="text-[9px] text-gray-400 uppercase tracking-widest font-mono">SOLID</span>
              <span class="text-sm font-bold text-gray-900 text-center px-1">${product.title.split(' ')[0]}</span>
              <span class="text-xs font-bold text-blue-600">${product.title.split(' ')[1] || ''}</span>
            </div>
          `}
          <p class="text-xs text-gray-600 font-mono mt-2 bg-white/90 px-3 py-0.5 rounded-full border border-gray-200">${product.weight} &bull; 100% Alcohol-Free</p>
        </div>
        <div class="space-y-4">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-900 text-white font-mono">${product.badge || 'LUXURY'}</span>
            <h3 class="text-xl font-bold text-gray-900 mt-2">${product.title}</h3>
            <p class="text-xs text-gray-500">${product.subtitle || ''}</p>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-black text-gray-900">₹${product.price}</span>
            <span class="text-sm text-gray-400 line-through font-mono">₹${product.comparePrice}</span>
          </div>
          <p class="text-xs text-gray-600 leading-relaxed">${product.description}</p>
          
          <div class="bg-gray-50 p-3 rounded-xl border border-gray-200 text-xs space-y-1">
            <p><strong class="text-gray-900">Top:</strong> ${product.topNotes || 'Citrus, Amber'}</p>
            <p><strong class="text-gray-900">Heart:</strong> ${product.heartNotes || 'Cedarwood, Spices'}</p>
            <p><strong class="text-gray-900">Base:</strong> ${product.baseNotes || 'Pure Musk, Oudh'}</p>
          </div>

          <div class="flex gap-3 pt-2">
            <button onclick="Store.addToCart('${product.id}', 1, true); Store.closeQuickView();" class="flex-1 py-3 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs uppercase shadow-md transition-all">
              Add To Bag &bull; ₹${product.price}
            </button>
            <a href="/product.html?id=${product.id}" class="px-4 py-3 rounded-xl bg-white border border-gray-300 text-gray-700 hover:border-gray-900 text-xs font-semibold">
              Full Notes
            </a>
          </div>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  },

  closeQuickView() {
    document.getElementById('quick-view-modal')?.classList.add('hidden');
  },

  openCart() {
    const drawer = document.getElementById('cart-drawer');
    if (drawer) {
      drawer.classList.remove('translate-x-full');
      document.getElementById('cart-backdrop')?.classList.remove('hidden');
    }
  },

  closeCart() {
    const drawer = document.getElementById('cart-drawer');
    if (drawer) {
      drawer.classList.add('translate-x-full');
      document.getElementById('cart-backdrop')?.classList.add('hidden');
    }
  },

  showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl ${isError ? 'bg-red-950/90 border-red-500 text-red-200' : 'bg-[#0E0E14] border-[#C5A059] text-[#F7EBD0] glow-gold-sm'} border shadow-2xl text-xs font-semibold flex items-center gap-2 transform translate-y-3 opacity-0 transition-all duration-300 backdrop-blur-md`;
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('translate-y-3', 'opacity-0');
    }, 15);

    setTimeout(() => {
      toast.classList.add('translate-y-3', 'opacity-0');
      setTimeout(() => toast.remove(), 320);
    }, 3200);
  },

  setupEventListeners() {
    window.addEventListener('click', (e) => {
      const modal = document.getElementById('quick-view-modal');
      if (e.target === modal) this.closeQuickView();
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  Store.init();
});
