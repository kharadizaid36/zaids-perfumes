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
        <div class="col-span-full text-center py-16 text-gray-400">
          <p class="text-base font-serif-luxury text-[#E5C378]">No fragrances found in this category.</p>
          <button onclick="Store.setCategory('All')" class="mt-4 px-5 py-2 rounded-xl gradient-gold-btn text-black text-xs font-bold font-serif-luxury">View Entire Collection</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.products.map(p => {
      const discountPercent = Math.round(((p.comparePrice - p.price) / p.comparePrice) * 100);
      return `
        <div class="product-card bg-[#0F0F14] rounded-2xl p-4 glow-border flex flex-col justify-between group relative overflow-hidden transition-all duration-300">
          ${p.badge ? `
            <div class="absolute top-3 left-3 z-10">
              <span class="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#C5A059] text-black shadow-md font-mono">${p.badge}</span>
            </div>
          ` : ''}

          <!-- Visual Tin / Perfume Graphic with Zoom -->
          <a href="/product.html?id=${p.id}" class="product-image-container w-full h-52 rounded-xl bg-gradient-to-b ${p.gradient || 'from-[#171720] to-[#0A0A0E]'} border border-white/5 flex flex-col items-center justify-center relative p-3 group-hover:border-[#C5A059]/40 transition-all cursor-pointer overflow-hidden">
            ${p.image ? `
              <img src="${p.image}" alt="${p.title}" class="w-full h-40 object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.85)] group-hover:scale-105 transition-transform duration-500" loading="lazy" onerror="if(this.src!=='${p.localImage || ''}' && '${p.localImage || ''}'){this.src='${p.localImage || ''}';}else{this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';}">
              <div class="perfume-graphic w-28 h-28 rounded-full border-2 border-[#C5A059]/70 bg-[#14120C] hidden flex-col items-center justify-center shadow-xl">
                <span class="text-[8px] text-gray-400 uppercase tracking-widest font-mono">SOLID</span>
                <span class="text-xs font-bold font-serif-luxury text-[#F7EBD0] text-center px-1 leading-tight">${p.title.split(' ')[0]}</span>
                <span class="text-[9px] font-bold text-[#C5A059] font-serif-luxury">${p.title.split(' ')[1] || 'PERFUME'}</span>
              </div>
            ` : `
              <div class="perfume-graphic w-28 h-28 rounded-full border-2 border-[#C5A059]/70 bg-[#14120C] flex flex-col items-center justify-center shadow-xl group-hover:shadow-[0_0_25px_rgba(229,195,120,0.3)]">
                <span class="text-[8px] text-gray-400 uppercase tracking-widest font-mono">SOLID</span>
                <span class="text-xs font-bold font-serif-luxury text-[#F7EBD0] text-center px-1 leading-tight">${p.title.split(' ')[0]}</span>
                <span class="text-[9px] font-bold text-[#C5A059] font-serif-luxury">${p.title.split(' ')[1] || 'PERFUME'}</span>
              </div>
            `}
            <span class="absolute bottom-2 text-[10px] text-gray-300 font-mono tracking-tight bg-black/70 px-2 py-0.5 rounded-full border border-white/10 backdrop-blur-sm">${p.weight || '18g'} &bull; ${p.category}</span>
          </a>

          <!-- Details -->
          <div class="mt-4 space-y-2">
            <div class="flex items-center justify-between text-xs">
              <div class="flex items-center text-[#E5C378]">
                ★★★★★ <span class="text-gray-400 text-[10px] ml-1">(${p.reviewCount || 40})</span>
              </div>
              <span class="text-[11px] text-gray-400 font-mono">${p.longevity || '8+ Hours'}</span>
            </div>

            <a href="/product.html?id=${p.id}" class="block">
              <h3 class="text-base font-bold font-serif-luxury text-white group-hover:text-[#F7EBD0] transition-colors line-clamp-1">
                ${p.title}
              </h3>
            </a>

            <p class="text-xs text-gray-400 line-clamp-2 leading-relaxed">
              ${p.subtitle || p.description}
            </p>

            <div class="flex items-baseline gap-2 pt-1">
              <span class="text-base font-extrabold text-[#F7EBD0]">₹${p.price}</span>
              ${p.comparePrice ? `<span class="text-xs text-gray-500 line-through font-mono">₹${p.comparePrice}</span>` : ''}
              ${discountPercent > 0 ? `<span class="text-[10px] text-green-400 font-semibold font-mono">${discountPercent}% OFF</span>` : ''}
            </div>
          </div>

          <!-- Action buttons with Fly To Cart Trigger -->
          <div class="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
            <button onclick="Store.addToCartWithAnimation('${p.id}', event)" class="add-to-cart-btn flex-1 py-2.5 rounded-xl gradient-gold-btn text-black font-bold text-xs uppercase tracking-wider font-serif-luxury flex items-center justify-center gap-1.5 shadow-md">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              <span>Add to Bag</span>
            </button>
            <button onclick="Store.openQuickView('${p.id}')" class="p-2.5 rounded-xl bg-[#161622] border border-white/10 hover:border-[#C5A059] text-gray-300 hover:text-[#E5C378] transition-colors" title="Quick View">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
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
        btn.className = "cat-tab-btn px-4 py-2 rounded-xl bg-[#C5A059] text-black font-bold text-xs uppercase tracking-wider font-serif-luxury shadow-md shadow-[#C5A059]/30 transition-all";
      } else {
        btn.className = "cat-tab-btn px-4 py-2 rounded-xl bg-[#121218] border border-white/10 text-gray-300 hover:border-[#C5A059]/40 text-xs uppercase tracking-wider font-serif-luxury transition-all";
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
        <div class="flex items-center justify-between p-3.5 rounded-xl bg-[#12121A] border border-white/5 hover:border-[#C5A059]/30 transition-all">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-lg bg-black/60 border border-[#C5A059]/40 flex items-center justify-center overflow-hidden flex-shrink-0">
              ${item.image ? `
                <img src="${item.image}" alt="${item.title}" class="w-full h-full object-contain p-0.5" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='block';">
                <span class="font-bold text-xs text-[#E5C378] font-serif-luxury hidden">Z</span>
              ` : `
                <span class="font-bold text-xs text-[#E5C378] font-serif-luxury">Z</span>
              `}
            </div>
            <div>
              <p class="text-xs font-bold text-white line-clamp-1">${item.title}</p>
              <p class="text-[11px] text-gray-400 font-mono">${item.weight} &bull; ₹${item.price} each</p>
              <div class="flex items-center gap-2 mt-1.5">
                <button onclick="Store.updateQuantity('${item.productId}', -1)" class="w-5 h-5 rounded bg-black/60 border border-white/10 text-xs flex items-center justify-center text-gray-300 hover:text-white">-</button>
                <span class="text-xs font-bold text-[#F7EBD0] px-1">${item.quantity}</span>
                <button onclick="Store.updateQuantity('${item.productId}', 1)" class="w-5 h-5 rounded bg-black/60 border border-white/10 text-xs flex items-center justify-center text-gray-300 hover:text-white">+</button>
              </div>
            </div>
          </div>
          <div class="text-right space-y-1">
            <p class="text-xs font-bold text-[#F7EBD0]">₹${item.price * item.quantity}</p>
            <button onclick="Store.removeFromCart('${item.productId}')" class="text-[10px] text-red-400 hover:underline">Remove</button>
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
        <div class="h-64 rounded-2xl bg-gradient-to-b ${product.gradient || 'from-[#181822] to-[#0A0A0E]'} border border-[#C5A059]/40 flex flex-col items-center justify-center p-4 relative overflow-hidden">
          ${product.image ? `
            <img src="${product.image}" alt="${product.title}" class="w-full h-48 object-contain drop-shadow-[0_10px_25px_rgba(0,0,0,0.9)]" onerror="if(this.src!=='${product.localImage || ''}' && '${product.localImage || ''}'){this.src='${product.localImage || ''}';}else{this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';}">
            <div class="w-32 h-32 rounded-full border-4 border-[#C5A059] bg-[#16130B] hidden flex-col items-center justify-center shadow-2xl">
              <span class="text-[9px] text-gray-400 uppercase tracking-widest font-mono">SOLID</span>
              <span class="text-sm font-bold font-serif-luxury text-[#F7EBD0] text-center px-1">${product.title.split(' ')[0]}</span>
              <span class="text-xs font-bold text-white font-serif-luxury">${product.title.split(' ')[1] || ''}</span>
            </div>
          ` : `
            <div class="w-32 h-32 rounded-full border-4 border-[#C5A059] bg-[#16130B] flex flex-col items-center justify-center shadow-2xl">
              <span class="text-[9px] text-gray-400 uppercase tracking-widest font-mono">SOLID</span>
              <span class="text-sm font-bold font-serif-luxury text-[#F7EBD0] text-center px-1">${product.title.split(' ')[0]}</span>
              <span class="text-xs font-bold text-white font-serif-luxury">${product.title.split(' ')[1] || ''}</span>
            </div>
          `}
          <p class="text-xs text-gray-300 font-mono mt-2 bg-black/70 px-3 py-0.5 rounded-full border border-white/10">${product.weight} &bull; 100% Alcohol-Free</p>
        </div>
        <div class="space-y-4">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#C5A059] text-black font-mono">${product.badge || 'LUXURY'}</span>
            <h3 class="text-xl font-bold font-serif-luxury text-white mt-2">${product.title}</h3>
            <p class="text-xs text-[#E5C378] font-serif-luxury">${product.subtitle || ''}</p>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-2xl font-black text-[#F7EBD0]">₹${product.price}</span>
            <span class="text-sm text-gray-500 line-through font-mono">₹${product.comparePrice}</span>
          </div>
          <p class="text-xs text-gray-300 leading-relaxed">${product.description}</p>
          
          <div class="bg-[#12121A] p-3 rounded-xl border border-white/5 text-xs space-y-1">
            <p><strong class="text-[#E5C378]">Top:</strong> ${product.topNotes || 'Citrus, Amber'}</p>
            <p><strong class="text-[#E5C378]">Heart:</strong> ${product.heartNotes || 'Cedarwood, Spices'}</p>
            <p><strong class="text-[#E5C378]">Base:</strong> ${product.baseNotes || 'Pure Musk, Oudh'}</p>
          </div>

          <div class="flex gap-3 pt-2">
            <button onclick="Store.addToCart('${product.id}', 1, true); Store.closeQuickView();" class="flex-1 py-3 rounded-xl gradient-gold-btn text-black font-bold text-xs uppercase font-serif-luxury">
              Add To Bag &bull; ₹${product.price}
            </button>
            <a href="/product.html?id=${product.id}" class="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-semibold hover:border-[#C5A059]">
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
