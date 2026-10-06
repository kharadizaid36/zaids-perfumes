/**
 * ZAID'S PERFUMES - Secure Admin Dashboard Controller
 */

const AdminApp = {
  activeTab: 'dashboard',
  stats: {},
  orders: [],
  products: [],
  coupons: [],
  settings: {},
  currentAdmin: null,
  soundEnabled: false,
  knownOrderIds: new Set(),
  originalDocTitle: document.title || "ZAID'S PERFUMES | Admin Control Panel",
  titleInterval: null,
  audioCtx: null,

  async init() {
    this.initEnvIndicator();
    this.initNotifications();
    const isAuthed = await this.checkAuth();
    if (!isAuthed) return;
    this.loadDashboard();
    this.setupNavigation();
    this.startOrdersPolling();
  },

  async authFetch(url, options = {}) {
    const token = localStorage.getItem('zp_admin_token');
    if (!token) {
      this.logout();
      return null;
    }
    options.headers = {
      ...(options.headers || {}),
      'Authorization': 'Bearer ' + token
    };

    try {
      const res = await fetch(url, options);
      if (res.status === 401 || res.status === 403) {
        alert('Admin session expired or access unauthorized. Please login again.');
        this.logout();
        return null;
      }
      return res;
    } catch (e) {
      console.error('Network error during authFetch:', e);
      throw e;
    }
  },

  async checkAuth() {
    const token = localStorage.getItem('zp_admin_token');
    if (!token) {
      window.location.href = '/admin/login.html';
      return false;
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (!data.success || data.user.role !== 'admin') {
        this.logout();
        return false;
      }

      this.currentAdmin = data.user;
      const adminNameEl = document.getElementById('admin-badge-name');
      if (adminNameEl) {
        adminNameEl.textContent = data.user.name || data.user.email;
      }
      return true;
    } catch (e) {
      this.logout();
      return false;
    }
  },

  logout() {
    localStorage.removeItem('zp_admin_token');
    localStorage.removeItem('zp_admin_user');
    window.location.href = '/admin/login.html';
  },

  setupNavigation() {
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });
  },

  switchTab(tab) {
    this.activeTab = tab;

    // Update nav buttons
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
      if (btn.dataset.tab === tab) {
        btn.className = "admin-nav-btn w-full text-left px-4 py-3 rounded-xl bg-[#D4AF37] text-black font-bold text-xs uppercase tracking-wider font-serif-luxury shadow-md flex items-center gap-2.5";
      } else {
        btn.className = "admin-nav-btn w-full text-left px-4 py-3 rounded-xl bg-transparent text-gray-400 hover:text-white hover:bg-white/5 font-medium text-xs uppercase tracking-wider font-serif-luxury flex items-center gap-2.5 transition-all";
      }
    });

    // Hide all tab sections
    ['dashboard', 'products', 'orders', 'verifications', 'coupons', 'settings'].forEach(t => {
      const el = document.getElementById(`tab-content-${t}`);
      if (el) el.classList.toggle('hidden', t !== tab);
    });

    // Refresh active tab data
    if (tab === 'dashboard') this.loadDashboard();
    if (tab === 'products') this.loadProducts();
    if (tab === 'orders') this.loadOrders();
    if (tab === 'verifications') this.loadVerifications();
    if (tab === 'coupons') this.loadCoupons();
    if (tab === 'settings') this.loadSettings();
  },

  // 1. DASHBOARD
  async loadDashboard() {
    try {
      const res = await this.authFetch('/api/admin/stats');
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        this.stats = data.stats;
        document.getElementById('dash-revenue').textContent = `₹${data.stats.totalRevenue.toLocaleString()}`;
        document.getElementById('dash-orders').textContent = `${data.stats.totalOrders} Orders`;
        document.getElementById('dash-products').textContent = `${data.stats.totalProducts} Items`;
        document.getElementById('dash-conversion').textContent = data.stats.conversionRate;

        // Render recent orders
        const recentTbody = document.getElementById('dash-recent-orders');
        if (recentTbody && data.recentOrders) {
          recentTbody.innerHTML = data.recentOrders.map(o => `
            <tr class="hover:bg-white/[0.02]">
              <td class="py-3 px-2 font-mono text-[#FFDF73]">#${o.id}</td>
              <td class="py-3 px-2 font-medium text-white">${o.customerName}</td>
              <td class="py-3 px-2 text-gray-400 font-mono">${o.paymentMethod}</td>
              <td class="py-3 px-2 font-bold text-[#FFDF73]">₹${o.total}</td>
              <td class="py-3 px-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${
                  o.orderStatus === 'Delivered' ? 'bg-emerald-900/40 text-emerald-300' :
                  o.orderStatus === 'Shipped' ? 'bg-blue-900/40 text-blue-300' : 'bg-amber-900/40 text-amber-300'
                }">
                  ${o.orderStatus}
                </span>
              </td>
            </tr>
          `).join('');
        }

        // Render low stock warning
        const lowStockContainer = document.getElementById('dash-low-stock');
        if (lowStockContainer && data.lowStockItems) {
          lowStockContainer.innerHTML = data.lowStockItems.map(p => `
            <div class="flex justify-between items-center p-2.5 rounded-xl bg-[#14141E] border border-red-500/20 text-xs">
              <div>
                <p class="font-bold text-white">${p.title}</p>
                <p class="text-red-400 font-mono text-[10px]">${p.stock} units remaining</p>
              </div>
              <button onclick="AdminApp.quickRestock('${p.id}')" class="px-2.5 py-1 rounded bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold font-serif-luxury">
                + Restock
              </button>
            </div>
          `).join('');
        }
        this.updateVerificationBadge();
      }
    } catch (e) {
      console.error(e);
    }
  },

  async updateVerificationBadge() {
    try {
      const res = await this.authFetch('/api/orders?verification=pending');
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        const count = (data.orders || []).length;
        const navBadge = document.getElementById('nav-pending-upi-count');
        if (navBadge) {
          navBadge.textContent = count;
          navBadge.className = count > 0 
            ? 'px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold font-mono animate-pulse'
            : 'px-2 py-0.5 rounded-full bg-white/10 text-gray-400 text-[10px] font-bold font-mono';
        }
        const summaryBadge = document.getElementById('verif-summary-badge');
        if (summaryBadge) {
          summaryBadge.textContent = `${count} Pending Verification`;
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  // 2. PRODUCTS
  async loadProducts() {
    try {
      const res = await this.authFetch('/api/products');
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        this.products = data.products;
        const tbody = document.getElementById('products-table-body');
        tbody.innerHTML = data.products.map(p => `
          <tr class="hover:bg-white/[0.02]">
            <td class="py-3 px-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-black border border-[#D4AF37]/40 flex items-center justify-center font-bold text-xs text-[#D4AF37] font-serif-luxury overflow-hidden flex-shrink-0">
                  ${p.image ? `<img src="${p.image}" class="w-full h-full object-contain p-0.5" onerror="if(this.src!=='${p.localImage || ''}' && '${p.localImage || ''}'){this.src='${p.localImage || ''}';}else{this.style.display='none';}}">` : `Z`}
                </div>
                <div>
                  <p class="font-bold text-white">${p.title}</p>
                  <p class="text-[10px] text-gray-400 font-mono">${p.weight || '18g'} &bull; ${p.category}</p>
                </div>
              </div>
            </td>
            <td class="py-3 px-3 font-mono text-gray-300">${p.category}</td>
            <td class="py-3 px-3">
              <div class="flex items-center gap-1">
                <button onclick="AdminApp.adjustPrice('${p.id}', -10)" class="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center text-xs transition-colors" title="Decrease Rate ₹10">−</button>
                <div class="relative">
                  <span class="absolute left-1.5 top-1 text-gray-400 text-xs font-mono">₹</span>
                  <input type="number" id="quick-price-${p.id}" value="${p.price}" oninput="AdminApp.markPriceDirty('${p.id}')" onkeydown="if(event.key==='Enter') AdminApp.saveQuickPrice('${p.id}')" class="w-16 pl-4 pr-1 py-1 rounded bg-[#14141E] border border-white/20 text-[#FFDF73] font-bold font-mono text-xs focus:border-[#D4AF37] focus:outline-none" title="Type new rate and press Enter or click Save">
                </div>
                <button onclick="AdminApp.adjustPrice('${p.id}', 10)" class="w-6 h-6 rounded bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center text-xs transition-colors" title="Increase Rate ₹10">+</button>
                <button id="btn-save-price-${p.id}" onclick="AdminApp.saveQuickPrice('${p.id}')" class="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow transition-all ml-1" title="Save new price">
                  Save
                </button>
              </div>
            </td>
            <td class="py-3 px-3 font-mono text-gray-400">₹${p.comparePrice || p.price}</td>
            <td class="py-3 px-3">
              <span class="font-mono text-xs ${p.stock <= 25 ? 'text-red-400 font-bold' : 'text-gray-300'}">${p.stock} in stock</span>
            </td>
            <td class="py-3 px-3">
              ${p.badge ? `<span class="px-2 py-0.5 rounded bg-[#D4AF37]/20 text-[#FFDF73] text-[10px] font-mono">${p.badge}</span>` : '-'}
            </td>
            <td class="py-3 px-3 text-right space-x-2">
              <button onclick="AdminApp.openEditProduct('${p.id}')" class="px-2.5 py-1 rounded bg-[#1A1A26] hover:bg-[#D4AF37] hover:text-black text-gray-300 text-[11px] font-medium transition-colors">Edit Details</button>
              <button onclick="AdminApp.deleteProduct('${p.id}')" class="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900 text-red-300 text-[11px] font-medium transition-colors">Delete</button>
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.error(e);
    }
  },

  openAddProductModal() {
    document.getElementById('product-modal-title').textContent = 'Add New Luxury Perfume';
    document.getElementById('prod-form-id').value = '';
    document.getElementById('prod-form-title').value = '';
    document.getElementById('prod-form-category').value = 'Solid Perfumes';
    document.getElementById('prod-form-price').value = '399';
    document.getElementById('prod-form-compare').value = '699';
    document.getElementById('prod-form-stock').value = '35';
    document.getElementById('prod-form-badge').value = 'NEW ARRIVAL';
    document.getElementById('prod-form-top').value = 'Calabrian Bergamot, Pink Pepper';
    document.getElementById('prod-form-heart').value = 'Cedarwood, French Lavender';
    document.getElementById('prod-form-base').value = 'Smoky Vetiver, Pure Ambergris';
    document.getElementById('prod-form-desc').value = 'Pure handcrafted solid cologne with 100% natural organic beeswax and shea butter.';

    document.getElementById('product-modal').classList.remove('hidden');
  },

  openEditProduct(id) {
    const p = this.products.find(item => item.id === id);
    if (!p) return;

    document.getElementById('product-modal-title').textContent = 'Edit Perfume: ' + p.title;
    document.getElementById('prod-form-id').value = p.id;
    document.getElementById('prod-form-title').value = p.title;
    document.getElementById('prod-form-category').value = p.category;
    document.getElementById('prod-form-price').value = p.price;
    document.getElementById('prod-form-compare').value = p.comparePrice || '';
    document.getElementById('prod-form-stock').value = p.stock || 30;
    document.getElementById('prod-form-badge').value = p.badge || '';
    document.getElementById('prod-form-top').value = p.topNotes || '';
    document.getElementById('prod-form-heart').value = p.heartNotes || '';
    document.getElementById('prod-form-base').value = p.baseNotes || '';
    document.getElementById('prod-form-desc').value = p.description || '';

    document.getElementById('product-modal').classList.remove('hidden');
  },

  closeProductModal() {
    document.getElementById('product-modal').classList.add('hidden');
  },

  async saveProduct() {
    const id = document.getElementById('prod-form-id').value;
    const title = document.getElementById('prod-form-title').value.trim();
    const category = document.getElementById('prod-form-category').value;
    const price = Number(document.getElementById('prod-form-price').value);
    const comparePrice = Number(document.getElementById('prod-form-compare').value) || 0;
    const stock = Number(document.getElementById('prod-form-stock').value) || 25;
    const badge = document.getElementById('prod-form-badge').value.trim();
    const topNotes = document.getElementById('prod-form-top').value.trim();
    const heartNotes = document.getElementById('prod-form-heart').value.trim();
    const baseNotes = document.getElementById('prod-form-base').value.trim();
    const description = document.getElementById('prod-form-desc').value.trim();

    if (!title || !price) {
      alert('Title and Price are required');
      return;
    }

    const payload = {
      title,
      category,
      price,
      comparePrice,
      stock,
      badge,
      topNotes,
      heartNotes,
      baseNotes,
      description,
      weight: '18g',
      longevity: '8-10 Hours',
      sillage: 'Intimate to Moderate'
    };

    try {
      const url = id ? `/api/products/${id}` : '/api/products';
      const method = id ? 'PUT' : 'POST';

      const res = await this.authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        this.closeProductModal();
        this.loadProducts();
      } else {
        alert(data.message || 'Error saving product');
      }
    } catch (e) {
      console.error(e);
    }
  },

  async deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this perfume?')) return;
    try {
      const res = await this.authFetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        this.loadProducts();
      }
    } catch (e) {
      console.error(e);
    }
  },

  async quickRestock(id) {
    const qty = prompt('Enter units to add to stock:', '30');
    if (!qty || isNaN(qty)) return;

    const prod = this.products.find(p => p.id === id) || (this.stats.lowStockItems || []).find(p => p.id === id);
    const newStock = (prod ? prod.stock : 0) + Number(qty);

    try {
      const res = await this.authFetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock })
      });
      if (!res) return;
      this.loadDashboard();
      this.loadProducts();
    } catch (e) {
      console.error(e);
    }
  },

  adjustPrice(id, delta) {
    const input = document.getElementById(`quick-price-${id}`);
    if (!input) return;
    const current = Number(input.value) || 0;
    const updated = Math.max(1, current + delta);
    input.value = updated;
    this.markPriceDirty(id);
  },

  markPriceDirty(id) {
    const btn = document.getElementById(`btn-save-price-${id}`);
    if (btn) {
      btn.className = 'px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-bold shadow animate-pulse ml-1';
      btn.textContent = 'Save*';
    }
  },

  async saveQuickPrice(id) {
    const input = document.getElementById(`quick-price-${id}`);
    const btn = document.getElementById(`btn-save-price-${id}`);
    if (!input) return;

    const newPrice = Number(input.value);
    if (!newPrice || newPrice <= 0) {
      alert('Please enter a valid price greater than ₹0');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = '...';
    }

    try {
      const res = await this.authFetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: newPrice })
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        if (btn) {
          btn.className = 'px-2.5 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold ml-1';
          btn.textContent = '✓ Saved';
          setTimeout(() => {
            btn.disabled = false;
            btn.textContent = 'Save';
          }, 2000);
        }
        // Update local object
        const p = this.products.find(item => item.id === id);
        if (p) p.price = newPrice;
      } else {
        alert(data.message || 'Error updating price');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Save';
        }
      }
    } catch (e) {
      console.error(e);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save';
      }
    }
  },

  // 3. ORDERS MANAGEMENT
  async loadOrders(isManual = false) {
    const spinner = document.getElementById('orders-refresh-spinner');
    if (spinner && isManual) {
      spinner.classList.add('animate-spin', 'inline-block');
    }
    try {
      const res = await this.authFetch('/api/orders');
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        // Real-time detection of newly arrived orders
        if (this.knownOrderIds && this.knownOrderIds.size > 0) {
          const newOrders = (data.orders || []).filter(o => !this.knownOrderIds.has(o.id));
          if (newOrders.length > 0) {
            newOrders.forEach(o => {
              this.knownOrderIds.add(o.id);
              this.triggerNewOrderAlert(o);
            });
          }
        } else {
          // Initialize known orders on first load
          this.knownOrderIds = new Set((data.orders || []).map(o => o.id));
        }

        // Update pending verifications badges
        const count = data.pendingVerificationCount || 0;
        const navBadge = document.getElementById('nav-pending-upi-count');
        if (navBadge) {
          navBadge.textContent = count;
          navBadge.className = count > 0 
            ? 'px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold font-mono animate-pulse'
            : 'px-2 py-0.5 rounded-full bg-white/10 text-gray-400 text-[10px] font-bold font-mono';
        }
        const summaryBadge = document.getElementById('verif-summary-badge');
        if (summaryBadge) {
          summaryBadge.textContent = `${count} Pending Verification`;
        }

        const tbody = document.getElementById('orders-table-body');
        tbody.innerHTML = data.orders.map(o => {
          let paymentHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 border border-white/10 text-gray-300">${o.paymentMethod}</span>`;
          if (o.paymentMethod === 'UPI') {
            if (o.paymentStatus === 'Verification Pending') {
              paymentHtml += `
                <div class="mt-1">
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-900/60 text-[#FFDF73] border border-amber-500/40 block">⚠️ Verification Pending</span>
                  <span class="text-[9px] font-mono text-gray-400 block mt-0.5">UTR: ${o.utrNumber || 'N/A'}</span>
                </div>
              `;
            } else if (o.paymentStatus.includes('Rejected')) {
              paymentHtml += `
                <div class="mt-1">
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-900/60 text-red-300 border border-red-500/40 block">✕ Rejected / Fake</span>
                </div>
              `;
            } else {
              paymentHtml += `
                <div class="mt-1">
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-900/60 text-emerald-300 border border-emerald-500/40 block">✓ Paid & Verified</span>
                  <span class="text-[9px] font-mono text-gray-400 block mt-0.5">UTR: ${o.utrNumber || 'N/A'}</span>
                </div>
              `;
            }
          }

          let actionsHtml = `
            <div class="flex items-center justify-end gap-1.5">
              <button onclick="AdminApp.printInvoice('${o.id}')" class="px-3 py-1 rounded-lg bg-[#181824] hover:bg-[#D4AF37] hover:text-black text-gray-300 text-xs font-semibold transition-colors">
                🧾 Invoice
              </button>
          `;

          if (o.paymentMethod === 'UPI' && o.paymentStatus === 'Verification Pending') {
            actionsHtml += `
              <button onclick="AdminApp.switchTab('verifications')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 hover:text-black text-[#FFDF73] border border-amber-500/40 text-xs font-bold font-serif-luxury transition-all">
                🛡️ Verify
              </button>
            `;
          }

          actionsHtml += `</div>`;

          return `
            <tr id="order-row-${o.id}" class="hover:bg-white/[0.02] transition-all duration-300">
              <td class="py-3 px-3 font-mono text-[#FFDF73] font-bold">#${o.id}</td>
              <td class="py-3 px-3">
                <p class="font-bold text-white">${o.customerName}</p>
                <p class="text-[10px] text-gray-400">${o.customerPhone} &bull; ${o.city}</p>
              </td>
              <td class="py-3 px-3 text-xs text-gray-300">
                ${(o.items || []).map(i => `${i.quantity}x ${i.title}`).join(', ')}
              </td>
              <td class="py-3 px-3">
                ${paymentHtml}
              </td>
              <td class="py-3 px-3 font-bold text-[#FFDF73]">₹${o.total}</td>
              <td class="py-3 px-3">
                <select onchange="AdminApp.updateStatus('${o.id}', this.value)" class="bg-[#14141E] border border-white/15 rounded-lg px-2.5 py-1 text-xs text-white focus:border-[#D4AF37] focus:outline-none">
                  <option value="Payment Under Verification" ${o.orderStatus === 'Payment Under Verification' ? 'selected' : ''}>Under Verification</option>
                  <option value="Placed" ${o.orderStatus === 'Placed' ? 'selected' : ''}>Placed</option>
                  <option value="Processing" ${o.orderStatus === 'Processing' ? 'selected' : ''}>Packed & Ready</option>
                  <option value="Shipped" ${o.orderStatus === 'Shipped' ? 'selected' : ''}>Shipped / Transit</option>
                  <option value="Delivered" ${o.orderStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
                  <option value="Cancelled" ${o.orderStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
              </td>
              <td class="py-3 px-3 text-right">
                ${actionsHtml}
              </td>
            </tr>
          `;
        }).join('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (spinner && isManual) {
        setTimeout(() => {
          spinner.classList.remove('animate-spin');
        }, 500);
      }
    }
  },

  initEnvIndicator() {
    const badge = document.getElementById('admin-env-badge');
    const text = document.getElementById('admin-env-text');
    if (!badge || !text) return;
    badge.classList.remove('hidden');

    const host = window.location.hostname;
    if (host.includes('onrender.com') || host.includes('render.com')) {
      text.innerHTML = '<span class="text-emerald-400 font-bold">● Render Cloud</span> <span class="text-[9px] text-gray-400">(Live Orders Syncing)</span>';
      badge.className = 'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-200';
    } else {
      text.innerHTML = '<span class="text-amber-400 font-bold">● Localhost</span> <span class="text-[9px] text-gray-400">(Offline Dev DB)</span>';
      badge.className = 'hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200';
    }
  },

  initAudioContext() {
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (e) {
      console.warn('AudioContext init error:', e);
    }
  },

  initNotifications() {
    this.originalDocTitle = document.title || "ZAID'S PERFUMES | Admin Control Panel";
    const savedSound = localStorage.getItem('zp_admin_sound_enabled');
    // If user previously enabled or browser push is allowed, turn sound ON
    if (savedSound === 'true' || (window.Notification && Notification.permission === 'granted')) {
      this.soundEnabled = true;
    }
    this.updateNotificationButtonUI();

    // Clear flashing title when window is clicked or focused
    window.addEventListener('focus', () => this.stopTitleFlashing());
    document.addEventListener('click', () => {
      this.initAudioContext();
      this.stopTitleFlashing();
    }, { once: false });
  },

  async toggleNotifications() {
    this.initAudioContext();

    if ('Notification' in window && Notification.permission !== 'granted') {
      try {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          this.soundEnabled = true;
        } else {
          // Keep sound enabled within browser even if OS notifications are denied
          this.soundEnabled = !this.soundEnabled;
        }
      } catch (e) {
        console.warn('Permission request error:', e);
        this.soundEnabled = !this.soundEnabled;
      }
    } else {
      this.soundEnabled = !this.soundEnabled;
    }

    localStorage.setItem('zp_admin_sound_enabled', this.soundEnabled ? 'true' : 'false');
    this.updateNotificationButtonUI();

    if (this.soundEnabled) {
      this.playOrderChime();
      this.showOrderToast({
        id: 'TEST',
        customerName: 'Sound Alerts Active!',
        total: 179,
        paymentMethod: 'Instant Alert',
        items: [{ title: 'Luxury Cash Register Chime Tested', quantity: 1 }]
      }, true);
    }
  },

  updateNotificationButtonUI() {
    const btn = document.getElementById('btn-toggle-notifs');
    const icon = document.getElementById('notif-bell-icon');
    const text = document.getElementById('notif-bell-text');
    const promptBanner = document.getElementById('notif-banner-prompt');

    if (!btn || !text) return;

    if (this.soundEnabled) {
      btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 transition-all font-mono text-xs cursor-pointer shadow-sm';
      if (icon) {
        icon.className = '';
        icon.textContent = '🔔';
      }
      text.textContent = 'Alerts: ON (Test)';
      if (promptBanner) promptBanner.classList.add('hidden');
    } else {
      btn.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-[#FFDF73] hover:bg-amber-500/30 transition-all font-mono text-xs cursor-pointer';
      if (icon) {
        icon.className = 'animate-bounce';
        icon.textContent = '🔔';
      }
      text.textContent = 'Sound Alerts: OFF';
      if (promptBanner) promptBanner.classList.remove('hidden');
    }
  },

  playOrderChime() {
    try {
      this.initAudioContext();
      if (!this.audioCtx) return;
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      // Note 1: 880Hz (A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.15);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      // Note 2: 1760Hz (A6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1760, now + 0.12);
      gain2.gain.setValueAtTime(0.35, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 1.2);

      // Note 3: 2640Hz (E7) - Shimmer
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(2640, now + 0.22);
      gain3.gain.setValueAtTime(0.2, now + 0.22);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.22);
      osc3.stop(now + 1.5);
    } catch (e) {
      console.warn('Audio chime playback failed:', e);
    }
  },

  triggerNewOrderAlert(order) {
    // 1. Play Audio Chime
    if (this.soundEnabled) {
      this.playOrderChime();
    }

    // 2. Browser Native Push Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const notif = new Notification(`🛍️ NEW ORDER: #${order.id}!`, {
          body: `Customer: ${order.customerName} • Total: ₹${order.total} (${order.paymentMethod})\nClick to view in Admin Panel.`,
          icon: '/images/logo-emblem.png',
          badge: '/images/logo-emblem.png',
          tag: `order-${order.id}`,
          renotify: true,
          requireInteraction: true
        });
        notif.onclick = () => {
          window.focus();
          this.viewOrderFromToast(order.id);
          notif.close();
        };
      } catch (e) {
        console.warn('Browser notification error:', e);
      }
    }

    // 3. Floating In-App Pop-up Card
    this.showOrderToast(order);

    // 4. Flashing Browser Tab Title
    this.startTitleFlashing(`🔔 NEW ORDER #${order.id}!`);
  },

  showOrderToast(order, isTest = false) {
    const container = document.getElementById('order-toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.id = `toast-order-${order.id}`;
    toast.className = 'pointer-events-auto bg-[#101018] border-2 border-[#D4AF37] rounded-2xl p-4 shadow-2xl glow-gold-lg flex items-start justify-between gap-3 animate-bounce transition-all';
    
    const itemsDesc = (order.items || []).map(i => `${i.quantity || 1}x ${i.title}`).join(', ') || 'Perfume Order';

    toast.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center text-xl flex-shrink-0 border border-amber-500/40">
          🔔
        </div>
        <div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full ${isTest ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'} font-mono text-[10px] font-bold">
              ${isTest ? 'TEST ALERT' : 'NEW ORDER'}
            </span>
            <span class="text-[#FFDF73] font-mono text-xs font-bold">#${order.id}</span>
          </div>
          <h4 class="font-bold text-white text-sm mt-0.5">${order.customerName}</h4>
          <p class="text-xs text-[#FFDF73] font-bold font-mono">Total: ₹${order.total} <span class="text-gray-400 font-normal">(${order.paymentMethod})</span></p>
          <p class="text-[10px] text-gray-400 mt-0.5 line-clamp-1">${itemsDesc}</p>
        </div>
      </div>
      <div class="flex flex-col gap-1.5 items-end flex-shrink-0">
        ${!isTest ? `
          <button onclick="AdminApp.viewOrderFromToast('${order.id}')" class="px-3 py-1.5 rounded-xl gradient-gold-btn text-black font-bold text-xs shadow-md whitespace-nowrap">
            View Order &rarr;
          </button>
        ` : ''}
        <button onclick="document.getElementById('toast-order-${order.id}')?.remove()" class="text-gray-400 hover:text-white text-xs px-2 py-0.5">
          ✕ Dismiss
        </button>
      </div>
    `;

    container.appendChild(toast);

    // Auto dismiss after 15 seconds
    setTimeout(() => {
      if (toast && toast.parentNode) {
        toast.classList.remove('animate-bounce');
        toast.classList.add('opacity-0', 'transition-opacity');
        setTimeout(() => toast.remove(), 400);
      }
    }, 15000);
  },

  viewOrderFromToast(orderId) {
    this.switchTab('orders');
    const toast = document.getElementById(`toast-order-${orderId}`);
    if (toast) toast.remove();
    this.stopTitleFlashing();

    setTimeout(() => {
      const row = document.getElementById(`order-row-${orderId}`);
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.classList.add('bg-[#D4AF37]/30', 'outline', 'outline-amber-400');
        setTimeout(() => {
          row.classList.remove('bg-[#D4AF37]/30', 'outline', 'outline-amber-400');
        }, 4000);
      }
    }, 300);
  },

  startTitleFlashing(alertText) {
    this.stopTitleFlashing();
    let toggle = false;
    this.titleInterval = setInterval(() => {
      document.title = toggle ? alertText : this.originalDocTitle;
      toggle = !toggle;
    }, 900);
  },

  stopTitleFlashing() {
    if (this.titleInterval) {
      clearInterval(this.titleInterval);
      this.titleInterval = null;
    }
    if (this.originalDocTitle) {
      document.title = this.originalDocTitle;
    }
  },

  startOrdersPolling() {
    // Automatically poll every 10 seconds for real-time new order alerts
    setInterval(() => {
      if (localStorage.getItem('zp_admin_token')) {
        this.loadOrders(false);
      }
    }, 10000);
  },

  // 3B. UPI PAYMENT VERIFICATIONS
  async loadVerifications() {
    try {
      const res = await this.authFetch('/api/orders?verification=pending');
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        const tbody = document.getElementById('verifications-table-body');
        const count = (data.orders || []).length;

        // Update badge counts
        const navBadge = document.getElementById('nav-pending-upi-count');
        if (navBadge) {
          navBadge.textContent = count;
          navBadge.className = count > 0 
            ? 'px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-bold font-mono animate-pulse'
            : 'px-2 py-0.5 rounded-full bg-white/10 text-gray-400 text-[10px] font-bold font-mono';
        }
        const summaryBadge = document.getElementById('verif-summary-badge');
        if (summaryBadge) {
          summaryBadge.textContent = `${count} Pending Verification`;
        }

        if (count === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="6" class="py-12 text-center text-gray-400 font-mono text-xs">
                <span class="text-2xl block mb-2">🎉</span>
                Zero pending UPI verifications. All customer transactions are clean and confirmed!
              </td>
            </tr>
          `;
          return;
        }

        tbody.innerHTML = data.orders.map(o => `
          <tr class="hover:bg-white/[0.02]">
            <td class="py-3.5 px-3">
              <span class="font-mono text-[#FFDF73] font-bold text-sm">#${o.id}</span>
              <p class="text-[10px] text-gray-400 font-mono">${new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; ${new Date(o.createdAt).toLocaleDateString()}</p>
            </td>
            <td class="py-3.5 px-3">
              <p class="font-bold text-white text-xs">${o.customerName}</p>
              <p class="text-[10px] text-gray-400">${o.customerPhone}</p>
              <p class="text-[10px] text-gray-500">${o.city} - ${o.pincode}</p>
            </td>
            <td class="py-3.5 px-3">
              <span class="text-base font-black text-[#FFDF73] font-mono">₹${o.total}</span>
            </td>
            <td class="py-3.5 px-3">
              <div class="inline-flex items-center gap-2 p-1.5 rounded-lg bg-black/40 border border-amber-500/30">
                <span class="font-mono font-bold text-white tracking-widest text-xs">${o.utrNumber || 'MISSING'}</span>
                ${o.utrNumber ? `<button onclick="AdminApp.copyUtr('${o.utrNumber}')" class="px-2 py-0.5 rounded bg-white/10 hover:bg-[#D4AF37] hover:text-black text-gray-300 text-[10px] font-semibold transition-all">📋</button>` : ''}
              </div>
            </td>
            <td class="py-3.5 px-3">
              ${o.paymentProofUrl ? `
                <img src="${o.paymentProofUrl}" onclick="AdminApp.openProofModal('${o.paymentProofUrl}', '${o.id}')" class="w-12 h-12 object-cover rounded-lg border border-amber-500/50 cursor-pointer hover:scale-105 transition-transform shadow-md" title="Click to inspect proof receipt">
              ` : `
                <span class="text-[11px] text-gray-500 font-mono">No screenshot attached</span>
              `}
            </td>
            <td class="py-3.5 px-3 text-right">
              <div class="flex items-center justify-end gap-2">
                <button onclick="AdminApp.verifyPayment('${o.id}', 'approve')" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase font-serif-luxury shadow-md shadow-emerald-900/30 flex items-center gap-1.5 transition-all">
                  <span>✓</span>
                  <span>Approve & Mark Paid</span>
                </button>
                <button onclick="AdminApp.verifyPayment('${o.id}', 'reject')" class="px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/40 text-xs font-semibold transition-colors">
                  <span>✕</span>
                  <span>Reject Fraud</span>
                </button>
              </div>
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.error('Error loading verifications:', e);
    }
  },

  async verifyPayment(orderId, action) {
    if (action === 'approve') {
      const confirmApprove = confirm(`Are you sure you verified this transfer in your PhonePe / Bank SMS or statement?\n\nClick OK to mark Order #${orderId} as PAID and move it to PROCESSING.`);
      if (!confirmApprove) return;
    } else {
      const reason = prompt(`Enter rejection reason for Order #${orderId}:`, 'Payment not received in PhonePe account. Invalid or unmatched UTR.');
      if (reason === null) return; // User cancelled
      return this.sendVerificationRequest(orderId, action, reason);
    }
    return this.sendVerificationRequest(orderId, action, '');
  },

  async sendVerificationRequest(orderId, action, reason) {
    try {
      const res = await this.authFetch(`/api/orders/${orderId}/verify-payment`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        this.loadVerifications();
        this.loadOrders();
        this.loadDashboard();
      } else {
        alert(data.message || 'Error processing verification');
      }
    } catch (e) {
      console.error(e);
      alert('Network error while processing verification');
    }
  },

  copyUtr(utr) {
    navigator.clipboard.writeText(utr).then(() => {
      alert(`12-Digit UTR copied to clipboard:\n${utr}\n\nYou can now paste it into PhonePe/Bank search.`);
    }).catch(() => {
      prompt('Copy UTR Number:', utr);
    });
  },

  openProofModal(imgUrl, orderId) {
    const modal = document.getElementById('proof-modal');
    const img = document.getElementById('proof-modal-img');
    const title = document.getElementById('proof-modal-title');
    if (modal && img) {
      img.src = imgUrl;
      if (title) title.textContent = `Order #${orderId} - Customer Payment Proof`;
      modal.classList.remove('hidden');
    }
  },

  closeProofModal() {
    const modal = document.getElementById('proof-modal');
    if (modal) modal.classList.add('hidden');
  },

  async updateStatus(orderId, newStatus) {
    try {
      const res = await this.authFetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderStatus: newStatus })
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        alert(`Order #${orderId} updated to "${newStatus}"! Customer tracking will now show this live.`);
      }
    } catch (e) {
      console.error(e);
    }
  },

  printInvoice(orderId) {
    const o = this.orders.find(item => item.id === orderId);
    if (!o) return;

    const invoiceWin = window.open('', '_blank');
    invoiceWin.document.write(`
      <html>
      <head>
        <title>Invoice #${o.id} - ZAID'S PERFUMES</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #111; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #D4AF37; padding-bottom: 20px; }
          .brand { font-size: 24px; font-weight: bold; color: #000; letter-spacing: 2px; }
          .meta { text-align: right; font-size: 13px; color: #555; }
          .bill-to { margin: 30px 0; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
          th { background: #f8f8f8; text-align: left; padding: 10px; border-bottom: 1px solid #ddd; }
          td { padding: 10px; border-bottom: 1px solid #eee; }
          .total-box { margin-top: 20px; text-align: right; font-size: 14px; }
          .grand-total { font-size: 18px; font-weight: bold; color: #997A15; margin-top: 5px; }
          .footer { margin-top: 60px; font-size: 11px; text-align: center; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">ZAID'S PERFUMES</div>
            <div style="font-size: 12px; color: #D4AF37; font-weight: bold;">Pure Handcrafted Solid Perfumes & Luxury Scents</div>
            <div style="font-size: 12px; color: #666; margin-top: 5px;">Bandra West, Mumbai - 400050<br>GSTIN: 27AABCZ1234F1Z5</div>
          </div>
          <div class="meta">
            <h3 style="margin: 0; color: #D4AF37;">TAX INVOICE</h3>
            <p><strong>Invoice #:</strong> ${o.id}</p>
            <p><strong>Date:</strong> ${new Date(o.createdAt).toLocaleDateString()}</p>
            <p><strong>Payment:</strong> ${o.paymentMethod} (${o.paymentStatus})</p>
          </div>
        </div>

        <div class="bill-to">
          <strong>Delivered To:</strong><br>
          ${o.customerName}<br>
          ${o.shippingAddress}<br>
          ${o.city} - ${o.pincode}<br>
          Phone: ${o.customerPhone}
        </div>

        <table>
          <thead>
            <tr>
              <th>Item Description</th>
              <th>Qty</th>
              <th>Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(o.items || []).map(i => `
              <tr>
                <td>${i.title}</td>
                <td>${i.quantity}</td>
                <td>₹${i.price}</td>
                <td style="text-align: right;">₹${i.price * i.quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="total-box">
          <p>Subtotal: ₹${o.subtotal || o.total}</p>
          ${o.discount ? `<p style="color: green;">Discount (${o.couponUsed || 'Coupon'}): -₹${o.discount}</p>` : ''}
          <p>Express Shipping: FREE</p>
          <div class="grand-total">Total Payable: ₹${o.total}</div>
        </div>

        <div class="footer">
          Thank you for choosing ZAID'S PERFUMES! Handcrafted with organic beeswax, shea butter & royal fragrance oils.<br>
          For any questions, contact us at support@zaidsperfumes.com or +91 98765 43210.
        </div>
      </body>
      </html>
    `);
    invoiceWin.document.close();
    invoiceWin.focus();
    setTimeout(() => invoiceWin.print(), 500);
  },

  // 4. COUPONS MANAGEMENT
  async loadCoupons() {
    try {
      const res = await this.authFetch('/api/coupons');
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        this.coupons = data.coupons;
        const tbody = document.getElementById('coupons-table-body');
        tbody.innerHTML = data.coupons.map(c => `
          <tr class="hover:bg-white/[0.02]">
            <td class="py-3 px-3 font-mono text-[#FFDF73] font-bold">${c.code}</td>
            <td class="py-3 px-3 text-xs text-white">${c.discountType === 'percentage' ? `${c.discountValue}% OFF` : `₹${c.discountValue} Flat OFF`}</td>
            <td class="py-3 px-3 text-xs text-gray-400 font-mono">₹${c.minOrder || 0}</td>
            <td class="py-3 px-3 text-xs text-gray-400">${c.description || '-'}</td>
            <td class="py-3 px-3 text-right">
              <button onclick="AdminApp.deleteCoupon('${c.id}')" class="px-2.5 py-1 rounded bg-red-950/40 hover:bg-red-900 text-red-300 text-[11px] font-medium transition-colors">Delete</button>
            </td>
          </tr>
        `).join('');
      }
    } catch (e) {
      console.error(e);
    }
  },

  async createCoupon() {
    const code = document.getElementById('new-coupon-code').value.trim();
    const discountValue = Number(document.getElementById('new-coupon-val').value);
    const discountType = document.getElementById('new-coupon-type').value;
    const minOrder = Number(document.getElementById('new-coupon-min').value) || 0;
    const description = document.getElementById('new-coupon-desc').value.trim();

    if (!code || !discountValue) {
      alert('Please enter coupon code and discount value');
      return;
    }

    try {
      const res = await this.authFetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, discountValue, discountType, minOrder, description })
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        alert(`Coupon ${code} created successfully!`);
        document.getElementById('new-coupon-code').value = '';
        this.loadCoupons();
      }
    } catch (e) {
      console.error(e);
    }
  },

  async deleteCoupon(id) {
    if (!confirm('Delete this coupon code?')) return;
    try {
      const res = await this.authFetch(`/api/coupons/${id}`, { method: 'DELETE' });
      if (!res) return;
      this.loadCoupons();
    } catch (e) {
      console.error(e);
    }
  },

  // 5. SETTINGS
  async loadSettings() {
    try {
      const res = await this.authFetch('/api/admin/settings');
      if (!res) return;
      const data = await res.json();
      if (data.success && data.settings) {
        this.settings = data.settings;
        document.getElementById('set-store-name').value = data.settings.storeName || '';
        document.getElementById('set-tagline').value = data.settings.tagline || '';
        document.getElementById('set-announcement').value = data.settings.announcementText || '';
        document.getElementById('set-phone').value = data.settings.phone || '';
        document.getElementById('set-email').value = data.settings.email || '';
        const addressEl = document.getElementById('set-address');
        if (addressEl) addressEl.value = data.settings.address || '';
        document.getElementById('set-upi-id').value = data.settings.upiId || '';
        document.getElementById('set-threshold').value = data.settings.freeShippingThreshold || 499;
      }
    } catch (e) {
      console.error(e);
    }
  },

  async saveSettings() {
    const payload = {
      storeName: document.getElementById('set-store-name').value.trim(),
      tagline: document.getElementById('set-tagline').value.trim(),
      announcementText: document.getElementById('set-announcement').value.trim(),
      phone: document.getElementById('set-phone').value.trim(),
      email: document.getElementById('set-email').value.trim(),
      address: document.getElementById('set-address')?.value.trim() || '',
      upiId: document.getElementById('set-upi-id').value.trim(),
      freeShippingThreshold: Number(document.getElementById('set-threshold').value) || 499
    };

    try {
      const res = await this.authFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        alert('✨ Store settings saved successfully! Live storefront announcement updated.');
      }
    } catch (e) {
      console.error(e);
    }
  },

  // 6. PASSWORD MANAGEMENT
  async changePassword() {
    const currentPassword = document.getElementById('curr-password')?.value;
    const newPassword = document.getElementById('new-password')?.value;
    const confirmPassword = document.getElementById('confirm-password')?.value;
    const msgBox = document.getElementById('pwd-msg');

    if (!currentPassword || !newPassword) {
      if (msgBox) {
        msgBox.textContent = 'Please fill out all password fields.';
        msgBox.className = 'p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs';
        msgBox.classList.remove('hidden');
      }
      return;
    }

    if (newPassword.length < 6) {
      if (msgBox) {
        msgBox.textContent = 'New password must be at least 6 characters.';
        msgBox.className = 'p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs';
        msgBox.classList.remove('hidden');
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (msgBox) {
        msgBox.textContent = 'New passwords do not match.';
        msgBox.className = 'p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs';
        msgBox.classList.remove('hidden');
      }
      return;
    }

    try {
      const res = await this.authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (!res) return;
      const data = await res.json();
      if (data.success) {
        if (msgBox) {
          msgBox.textContent = '✨ Admin password updated securely!';
          msgBox.className = 'p-3 rounded-xl bg-green-950/60 border border-green-500/40 text-green-200 text-xs';
          msgBox.classList.remove('hidden');
        }
        document.getElementById('curr-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
      } else {
        if (msgBox) {
          msgBox.textContent = data.message || 'Failed to update password.';
          msgBox.className = 'p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs';
          msgBox.classList.remove('hidden');
        }
      }
    } catch (e) {
      if (msgBox) {
        msgBox.textContent = 'Error communicating with server.';
        msgBox.className = 'p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs';
        msgBox.classList.remove('hidden');
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminApp.init();
});
