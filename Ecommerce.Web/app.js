// API Base URL
const API_URL = 'http://localhost:5026';

// JWT Helper functions
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch {
        return null;
    }
}

function isUserAdmin(token) {
    const decoded = parseJwt(token);
    if (!decoded) return false;
    const rolesClaim = decoded['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || decoded['role'];
    if (!rolesClaim) return false;
    if (Array.isArray(rolesClaim)) {
        return rolesClaim.includes('Admin');
    }
    return rolesClaim === 'Admin';
}

// Global Application State
const state = {
    token: localStorage.getItem('token') || null,
    userEmail: localStorage.getItem('userEmail') || null,
    userFirstName: localStorage.getItem('userFirstName') || null,
    isAdmin: localStorage.getItem('token') ? isUserAdmin(localStorage.getItem('token')) : false,
    cart: null,
    currentPage: 1,
    pageSize: 6,
    activeView: 'catalog', // 'catalog' or 'orders' or 'admin'
    searchQuery: '',
    categoryId: '',
    brandId: '',
    sortBy: 'nameAsc'
};

// --- API Helpers ---
async function apiCall(endpoint, method = 'GET', body = null, requireAuth = false) {
    const headers = {
        'Content-Type': 'application/json'
    };

    if (requireAuth && state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
    }

    const config = {
        method,
        headers
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        
        if (response.status === 401) {
            // Handle expired/invalid token
            logout();
            showToast('Session expired. Please log in again.', 'error');
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            // Read error details
            const errorText = await response.text();
            let errorMessage = 'An error occurred';
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.detail || errorJson.message || errorMessage;
            } catch {
                errorMessage = errorText || errorMessage;
            }
            throw new Error(errorMessage);
        }

        // Return JSON if present, otherwise true/status
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        return true;
    } catch (err) {
        console.error(`API Error [${method} ${endpoint}]:`, err);
        throw err;
    }
}

// --- Toast System ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = '<i class="fa-solid fa-circle-check"></i>';
    if (type === 'error') {
        icon = '<i class="fa-solid fa-circle-exclamation"></i>';
    } else if (type === 'info') {
        icon = '<i class="fa-solid fa-circle-info"></i>';
    }

    toast.innerHTML = `${icon} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toast-in 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    updateAuthUI();
    
    // Fetch initial filters
    await fetchCategories();
    await fetchBrands();
    
    // Initial catalog load
    await loadCatalog();
    
    // Sync cart state
    if (state.token) {
        await syncCart();
    }
});

// --- Event Listeners Setup ---
function setupEventListeners() {
    // Navigation
    document.getElementById('btn-home').addEventListener('click', () => switchView('catalog'));
    document.getElementById('btn-hero-shop').addEventListener('click', () => {
        document.getElementById('section-catalog').scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('btn-back-to-shop').addEventListener('click', () => switchView('catalog'));
    document.getElementById('btn-orders').addEventListener('click', () => {
        if (!state.token) {
            openModal('auth-modal');
        } else {
            switchView('orders');
        }
    });

    // Search and Filters
    const searchInput = document.getElementById('search-input');
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            state.searchQuery = searchInput.value;
            state.currentPage = 1;
            loadCatalog();
        }, 500);
    });

    document.getElementById('search-btn').addEventListener('click', () => {
        state.searchQuery = searchInput.value;
        state.currentPage = 1;
        loadCatalog();
    });

    document.getElementById('filter-category').addEventListener('change', (e) => {
        state.categoryId = e.target.value;
        state.currentPage = 1;
        loadCatalog();
    });

    document.getElementById('filter-brand').addEventListener('change', (e) => {
        state.brandId = e.target.value;
        state.currentPage = 1;
        loadCatalog();
    });

    document.getElementById('sort-by').addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        state.currentPage = 1;
        loadCatalog();
    });

    // Cart Drawer Toggle
    document.getElementById('btn-cart-toggle').addEventListener('click', toggleCartDrawer);
    document.getElementById('btn-cart-close').addEventListener('click', toggleCartDrawer);
    document.getElementById('cart-overlay').addEventListener('click', toggleCartDrawer);

    // Auth Actions
    document.getElementById('btn-auth').addEventListener('click', () => {
        if (state.token) {
            // Confirm logout
            if (confirm('Are you sure you want to sign out?')) {
                logout();
            }
        } else {
            openModal('auth-modal');
        }
    });
    document.getElementById('btn-auth-close').addEventListener('click', () => closeModal('auth-modal'));
    document.getElementById('auth-overlay').addEventListener('click', () => closeModal('auth-modal'));

    // Auth Tabs switcher
    document.getElementById('tab-login').addEventListener('click', () => switchAuthForm('login'));
    document.getElementById('tab-register').addEventListener('click', () => switchAuthForm('register'));

    // Auth Forms Submission
    document.getElementById('form-login').addEventListener('submit', handleLogin);
    document.getElementById('form-register').addEventListener('submit', handleRegister);

    // Checkout Forms Submission
    document.getElementById('btn-checkout').addEventListener('click', handleCheckoutStep);
    document.getElementById('btn-checkout-close').addEventListener('click', () => closeModal('checkout-modal'));
    document.getElementById('checkout-overlay').addEventListener('click', () => closeModal('checkout-modal'));
    document.getElementById('form-checkout').addEventListener('submit', placeOrder);

    // Payment Simulations
    document.getElementById('btn-pay-success').addEventListener('click', () => processMockPayment(true));
    document.getElementById('btn-pay-fail').addEventListener('click', () => processMockPayment(false));

    // Admin Dashboard Navigation
    document.getElementById('btn-admin-dash').addEventListener('click', () => switchView('admin'));
    document.getElementById('btn-admin-back-to-shop').addEventListener('click', () => switchView('catalog'));
    
    // Admin Panel Subviews Switcher
    document.getElementById('btn-admin-tab-products').addEventListener('click', () => switchAdminTab('products'));
    document.getElementById('btn-admin-tab-orders').addEventListener('click', () => switchAdminTab('orders'));

    // Admin Product CRUD Actions
    document.getElementById('btn-add-product').addEventListener('click', () => openProductModal());
    document.getElementById('btn-product-modal-close').addEventListener('click', () => closeModal('product-modal'));
    document.getElementById('product-modal-overlay').addEventListener('click', () => closeModal('product-modal'));
    document.getElementById('form-product').addEventListener('submit', saveProduct);
}

// --- View Router ---
function switchView(view) {
    state.activeView = view;
    
    const catalogSec = document.getElementById('section-catalog');
    const heroSec = document.getElementById('hero-banner');
    const filtersSec = document.querySelector('.filters-container');
    const ordersSec = document.getElementById('section-orders');
    const adminSec = document.getElementById('section-admin');

    if (view === 'catalog') {
        catalogSec.classList.remove('hide');
        heroSec.classList.remove('hide');
        filtersSec.classList.remove('hide');
        ordersSec.classList.add('hide');
        adminSec.classList.add('hide');
        loadCatalog();
    } else if (view === 'orders') {
        catalogSec.classList.add('hide');
        heroSec.classList.add('hide');
        filtersSec.classList.add('hide');
        ordersSec.classList.remove('hide');
        adminSec.classList.add('hide');
        loadOrders();
    } else if (view === 'admin') {
        catalogSec.classList.add('hide');
        heroSec.classList.add('hide');
        filtersSec.classList.add('hide');
        ordersSec.classList.add('hide');
        adminSec.classList.remove('hide');
        switchAdminTab('products');
    }
}

// --- Fetch Filters ---
async function fetchCategories() {
    try {
        // Query catalog categories endpoint (mocking via products endpoints since we don't have separate categories controller)
        // Usually, product items have category relations. Let's populate mock options, or fetch from catalogs if endpoint is available.
        // We will seed categories manually since ASP.NET seeded standard database values:
        const categories = [
            { id: 1, name: 'Electronics' },
            { id: 2, name: 'Clothing' },
            { id: 3, name: 'Home & Kitchen' }
        ];
        const select = document.getElementById('filter-category');
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to populate categories filter', err);
    }
}

async function fetchBrands() {
    try {
        // Seed Brands (Apple: 1, Samsung: 2, Nike: 3)
        const brands = [
            { id: 1, name: 'Apple' },
            { id: 2, name: 'Samsung' },
            { id: 3, name: 'Nike' }
        ];
        const select = document.getElementById('filter-brand');
        brands.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            select.appendChild(opt);
        });
    } catch (err) {
        console.error('Failed to populate brands filter', err);
    }
}

// --- Load Product Catalog ---
async function loadCatalog() {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = getSkeletonHTML();
    
    // Build query params
    let url = `/api/Products?pageNumber=${state.currentPage}&pageSize=${state.pageSize}`;
    if (state.searchQuery) url += `&search=${encodeURIComponent(state.searchQuery)}`;
    if (state.categoryId) url += `&categoryId=${state.categoryId}`;
    if (state.brandId) url += `&brandId=${state.brandId}`;
    if (state.sortBy) url += `&sortBy=${state.sortBy}`;

    try {
        // Fetch products list and pagination header
        const response = await fetch(`${API_URL}${url}`);
        if (!response.ok) throw new Error('Failed to fetch products');
        
        const products = await response.json();
        
        // Parse X-Pagination header
        const paginationHeader = response.headers.get('X-Pagination');
        let paginationMeta = { totalCount: products.length, totalPages: 1 };
        if (paginationHeader) {
            paginationMeta = JSON.parse(paginationHeader);
        }

        renderCatalog(products, paginationMeta);
    } catch (err) {
        grid.innerHTML = `<div class="error-placeholder"><i class="fa-solid fa-triangle-exclamation"></i><p>Could not connect to the API. Make sure the server is running on ${API_URL}</p></div>`;
        showToast('Error connecting to backend API.', 'error');
    }
}

function getSkeletonHTML() {
    let html = '';
    for (let i = 0; i < state.pageSize; i++) {
        html += `
            <div class="skeleton-card pulse">
                <div class="skeleton-img"></div>
                <div class="skeleton-title"></div>
                <div class="skeleton-desc"></div>
                <div class="skeleton-footer"></div>
            </div>
        `;
    }
    return html;
}

function renderCatalog(products, pagination) {
    const grid = document.getElementById('products-grid');
    const resultsMeta = document.getElementById('results-meta');
    
    resultsMeta.textContent = `Showing ${products.length} of ${pagination.totalCount} products`;

    if (products.length === 0) {
        grid.innerHTML = `<div class="empty-placeholder"><i class="fa-solid fa-box-open"></i><p>No products found matching your criteria.</p></div>`;
        document.getElementById('pagination').innerHTML = '';
        return;
    }

    grid.innerHTML = products.map(p => {
        // Default seed images mapping
        let imgUrl = 'https://placehold.co/300x200/1e293b/cbd5e1?text=' + encodeURIComponent(p.name);
        if (p.name.includes('iPhone')) imgUrl = 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=300&q=80';
        if (p.name.includes('Galaxy')) imgUrl = 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=300&q=80';
        if (p.name.includes('Nike')) imgUrl = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80';
        
        return `
            <div class="product-card">
                <div class="product-img-wrapper">
                    <span class="product-badge">${p.categoryName}</span>
                    <img src="${imgUrl}" alt="${p.name}">
                </div>
                <div class="product-details">
                    <span class="product-brand">${p.brandName}</span>
                    <h3 class="product-title">${p.name}</h3>
                    <p class="product-desc">${p.description}</p>
                    <div class="product-footer">
                        <span class="product-price">$${p.price.toFixed(2)}</span>
                        <button class="add-cart-btn" onclick="addToCart(${p.id}, '${p.name.replace(/'/g, "\\'")}')" title="Add to Bag">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    renderPagination(pagination);
}

function renderPagination(meta) {
    const pagin = document.getElementById('pagination');
    if (meta.totalPages <= 1) {
        pagin.innerHTML = '';
        return;
    }

    let html = `
        <button class="page-link ${meta.currentPage === 1 ? 'disabled' : ''}" onclick="changePage(${meta.currentPage - 1})">
            <i class="fa-solid fa-chevron-left"></i>
        </button>
    `;

    for (let i = 1; i <= meta.totalPages; i++) {
        html += `
            <button class="page-link ${meta.currentPage === i ? 'active' : ''}" onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }

    html += `
        <button class="page-link ${meta.currentPage === meta.totalPages ? 'disabled' : ''}" onclick="changePage(${meta.currentPage + 1})">
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    pagin.innerHTML = html;
}

window.changePage = (page) => {
    state.currentPage = page;
    loadCatalog();
    document.getElementById('section-catalog').scrollIntoView({ behavior: 'smooth' });
};

// --- Authentication Controllers ---
function updateAuthUI() {
    const authBtn = document.getElementById('btn-auth');
    const authLabel = document.getElementById('auth-label');
    const btnOrders = document.getElementById('btn-orders');
    const btnAdminDash = document.getElementById('btn-admin-dash');

    if (state.token) {
        authLabel.textContent = `Sign Out (${state.userFirstName || 'User'})`;
        authBtn.classList.add('active');
        btnOrders.classList.remove('hide');
        if (state.isAdmin) {
            btnAdminDash.classList.remove('hide');
        } else {
            btnAdminDash.classList.add('hide');
        }
    } else {
        authLabel.textContent = 'Sign In';
        authBtn.classList.remove('active');
        btnOrders.classList.add('hide');
        btnAdminDash.classList.add('hide');
        switchView('catalog'); // return to catalog view if logged out
    }
}

function switchAuthForm(tab) {
    const loginTab = document.getElementById('tab-login');
    const registerTab = document.getElementById('tab-register');
    const loginForm = document.getElementById('form-login');
    const registerForm = document.getElementById('form-register');

    if (tab === 'login') {
        loginTab.classList.add('active');
        registerTab.classList.remove('active');
        loginForm.classList.add('active');
        registerForm.classList.remove('active');
    } else {
        loginTab.classList.remove('active');
        registerTab.classList.add('active');
        loginForm.classList.remove('active');
        registerForm.classList.add('active');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const data = await apiCall('/api/Auth/login', 'POST', { email, password });
        
        state.token = data.token;
        state.userEmail = data.email;
        state.userFirstName = data.firstName;
        state.isAdmin = isUserAdmin(data.token);
        
        localStorage.setItem('token', data.token);
        localStorage.setItem('userEmail', data.email);
        localStorage.setItem('userFirstName', data.firstName);

        showToast(`Welcome back, ${data.firstName}!`);
        closeModal('auth-modal');
        updateAuthUI();
        
        // Sync cart after login
        await syncCart();
    } catch (err) {
        showToast(err.message || 'Login failed. Please check credentials.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const firstName = document.getElementById('reg-firstname').value;
    const lastName = document.getElementById('reg-lastname').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const address = document.getElementById('reg-address').value;
    const city = document.getElementById('reg-city').value;

    try {
        const data = await apiCall('/api/Auth/register', 'POST', {
            email,
            password,
            firstName,
            lastName,
            address,
            city
        });

        state.token = data.token;
        state.userEmail = data.email;
        state.userFirstName = data.firstName;
        state.isAdmin = isUserAdmin(data.token);

        localStorage.setItem('token', data.token);
        localStorage.setItem('userEmail', data.email);
        localStorage.setItem('userFirstName', data.firstName);

        showToast('Registration successful! Welcome.');
        closeModal('auth-modal');
        updateAuthUI();
        
        // Sync cart
        await syncCart();
    } catch (err) {
        showToast(err.message || 'Registration failed.', 'error');
    }
}

function logout() {
    state.token = null;
    state.userEmail = null;
    state.userFirstName = null;
    state.isAdmin = false;
    state.cart = null;

    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userFirstName');
    
    updateAuthUI();
    renderCart(); // Empty cart representation
    document.getElementById('cart-count').textContent = '0';
    showToast('Successfully signed out.');
}

// --- Cart Operations ---
function toggleCartDrawer() {
    document.getElementById('cart-drawer').classList.toggle('open');
}

async function syncCart() {
    if (!state.token) return;
    try {
        const data = await apiCall('/api/Carts', 'GET', null, true);
        state.cart = data;
        renderCart();
    } catch (err) {
        console.error('Failed to sync cart:', err);
    }
}

function renderCart() {
    const container = document.getElementById('cart-items-container');
    const badge = document.getElementById('cart-count');
    const subtotal = document.getElementById('cart-subtotal');
    const checkBtn = document.getElementById('btn-checkout');

    if (!state.cart || !state.cart.items || state.cart.items.length === 0) {
        container.innerHTML = `<div class="empty-cart-view"><i class="fa-solid fa-bag-shopping"></i><p>Your bag is empty.</p></div>`;
        badge.textContent = '0';
        subtotal.textContent = '$0.00';
        checkBtn.disabled = true;
        return;
    }

    // Count distinct items
    badge.textContent = state.cart.items.reduce((acc, curr) => acc + curr.quantity, 0);
    subtotal.textContent = `$${state.cart.totalPrice.toFixed(2)}`;
    checkBtn.disabled = false;

    container.innerHTML = state.cart.items.map(item => {
        let imgUrl = 'https://placehold.co/100x100/1e293b/cbd5e1?text=' + encodeURIComponent(item.productName);
        if (item.productName.includes('iPhone')) imgUrl = 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=100&q=80';
        if (item.productName.includes('Galaxy')) imgUrl = 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=100&q=80';
        if (item.productName.includes('Nike')) imgUrl = 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&q=80';

        return `
            <div class="cart-item">
                <div class="cart-item-img">
                    <img src="${imgUrl}" alt="${item.productName}">
                </div>
                <div class="cart-item-info">
                    <h4 class="cart-item-title">${item.productName}</h4>
                    <span class="cart-item-price">$${item.price.toFixed(2)}</span>
                    <div class="cart-item-controls">
                        <div class="quantity-control">
                            <button class="qty-btn" onclick="updateQty(${item.productId}, ${item.quantity - 1})"><i class="fa-solid fa-minus"></i></button>
                            <span class="qty-val">${item.quantity}</span>
                            <button class="qty-btn" onclick="updateQty(${item.productId}, ${item.quantity + 1})"><i class="fa-solid fa-plus"></i></button>
                        </div>
                        <button class="remove-item-btn" onclick="removeCartItem(${item.productId})" title="Remove item">
                            <i class="fa-regular fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.addToCart = async (productId, name) => {
    if (!state.token) {
        showToast('Please sign in to add items to your cart.', 'info');
        openModal('auth-modal');
        return;
    }

    try {
        const data = await apiCall('/api/Carts/items', 'POST', { productId, quantity: 1 }, true);
        state.cart = data;
        renderCart();
        showToast(`Added ${name} to your bag.`);
    } catch (err) {
        showToast('Could not add product to cart.', 'error');
    }
};

window.updateQty = async (productId, newQty) => {
    if (newQty <= 0) {
        await removeCartItem(productId);
        return;
    }
    try {
        const data = await apiCall('/api/Carts/items', 'POST', { productId, quantity: newQty }, true);
        state.cart = data;
        renderCart();
    } catch (err) {
        showToast('Could not update quantity.', 'error');
    }
};

window.removeCartItem = async (productId) => {
    try {
        const data = await apiCall(`/api/Carts/items/${productId}`, 'DELETE', null, true);
        state.cart = data;
        renderCart();
        showToast('Item removed from bag.', 'info');
    } catch (err) {
        showToast('Could not remove item.', 'error');
    }
};

// --- Checkout Flow ---
function handleCheckoutStep() {
    toggleCartDrawer();
    
    if (!state.token) {
        showToast('Please sign in to checkout.', 'info');
        openModal('auth-modal');
        return;
    }

    // Set prices in modal
    document.getElementById('checkout-items-total').textContent = `$${state.cart.totalPrice.toFixed(2)}`;
    document.getElementById('checkout-grand-total').textContent = `$${state.cart.totalPrice.toFixed(2)}`;
    
    openModal('checkout-modal');
}

async function placeOrder(e) {
    e.preventDefault();
    const street = document.getElementById('ship-street').value;
    const city = document.getElementById('ship-city').value;
    const postalCode = document.getElementById('ship-postal').value;
    const country = document.getElementById('ship-country').value;

    const payload = {
        shippingStreet: street,
        shippingCity: city,
        shippingPostalCode: postalCode,
        shippingCountry: country
    };

    try {
        const orderData = await apiCall('/api/Orders', 'POST', payload, true);
        closeModal('checkout-modal');
        
        // Save current transaction order info
        state.activeOrderId = orderData.id;
        state.activeOrderTotal = orderData.totalAmount;
        
        // Open payment modal
        document.getElementById('payment-order-id').textContent = orderData.id;
        document.getElementById('payment-amount').textContent = `$${orderData.totalAmount.toFixed(2)}`;
        
        openModal('payment-modal');
        
        // Reset local cart cached state
        state.cart = null;
        renderCart();
        document.getElementById('cart-count').textContent = '0';
    } catch (err) {
        showToast(err.message || 'Failed to place order.', 'error');
    }
}

// --- Payment Simulations ---
async function processMockPayment(success) {
    const orderId = state.activeOrderId;
    const amount = state.activeOrderTotal;

    if (!orderId) return;

    try {
        if (success) {
            // 1. Create a payment session
            await apiCall(`/api/Payments/session/${orderId}`, 'POST', null, true);
            // 2. Verify payment (simulated callback)
            await apiCall(`/api/Payments/verify?txnRef=MOCK_TXN_${Date.now()}&orderId=${orderId}`, 'POST', null, true);
            
            showToast(`Payment successful! Order #${orderId} is confirmed.`);
            closeModal('payment-modal');
            switchView('orders');
        } else {
            showToast('Simulated payment cancelled/failed. You can retry from your orders history.', 'error');
            closeModal('payment-modal');
            switchView('orders');
        }
    } catch (err) {
        showToast(err.message || 'Payment processing failed.', 'error');
        closeModal('payment-modal');
        switchView('orders');
    }
}

// --- Order History Loader ---
async function loadOrders() {
    const list = document.getElementById('orders-list');
    list.innerHTML = `<div class="skeleton-card pulse"><div class="skeleton-title"></div><div class="skeleton-desc"></div></div>`;

    try {
        const orders = await apiCall('/api/Orders', 'GET', null, true);
        
        if (orders.length === 0) {
            list.innerHTML = `<div class="empty-placeholder"><i class="fa-solid fa-receipt"></i><p>You haven't placed any orders yet.</p></div>`;
            return;
        }

        // Sort orders descending
        orders.sort((a,b) => b.id - a.id);

        list.innerHTML = orders.map(o => {
            const dateStr = new Date(o.orderDate).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            
            let statusClass = 'status-pending';
            if (o.status === 'Completed' || o.status === 'Shipped') statusClass = 'status-completed';
            if (o.status === 'Failed' || o.status === 'Cancelled') statusClass = 'status-failed';

            const itemsRows = o.orderItems.map(item => `
                <div class="order-item-row">
                    <span>${item.productName} <span class="order-item-qty">x${item.quantity}</span></span>
                    <span>$${(item.price * item.quantity).toFixed(2)}</span>
                </div>
            `).join('');

            // If pending, show pay button option
            const showPayButton = o.status === 'Pending';
            const payBtnHTML = showPayButton ? `
                <button class="header-btn" onclick="retryPayment(${o.id}, ${o.totalAmount})" style="margin-top: 15px; width: 100%; justify-content: center; background: rgba(16, 185, 129, 0.1); border-color: var(--accent-green); color: var(--accent-green);">
                    <i class="fa-solid fa-credit-card"></i> Pay Now ($${o.totalAmount.toFixed(2)})
                </button>
            ` : '';

            return `
                <div class="order-card">
                    <div class="order-card-header">
                        <div>
                            <span class="order-id">Order #${o.id}</span>
                            <div class="order-date">${dateStr}</div>
                        </div>
                        <span class="order-status-badge ${statusClass}">${o.status}</span>
                    </div>
                    <div class="order-items">
                        ${itemsRows}
                    </div>
                    <div class="order-card-footer">
                        <span>Total Paid</span>
                        <span>$${o.totalAmount.toFixed(2)}</span>
                    </div>
                    ${payBtnHTML}
                </div>
            `;
        }).join('');
    } catch (err) {
        list.innerHTML = `<div class="error-placeholder"><i class="fa-solid fa-triangle-exclamation"></i><p>Could not fetch order history.</p></div>`;
    }
}

window.retryPayment = (orderId, amount) => {
    state.activeOrderId = orderId;
    state.activeOrderTotal = amount;
    
    document.getElementById('payment-order-id').textContent = orderId;
    document.getElementById('payment-amount').textContent = `$${amount.toFixed(2)}`;
    
    openModal('payment-modal');
};

// --- Modal Utilities ---
function openModal(id) {
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

// --- Admin Dashboard Logic ---

// Toggle between Products and Orders tabs in Admin Panel
window.switchAdminTab = (tab) => {
    const prodTabBtn = document.getElementById('btn-admin-tab-products');
    const orderTabBtn = document.getElementById('btn-admin-tab-orders');
    const prodView = document.getElementById('admin-products-view');
    const orderView = document.getElementById('admin-orders-view');

    if (tab === 'products') {
        prodTabBtn.className = 'auth-btn';
        orderTabBtn.className = 'header-btn';
        prodView.classList.remove('hide');
        orderView.classList.add('hide');
        loadAdminProducts();
    } else {
        prodTabBtn.className = 'header-btn';
        orderTabBtn.className = 'auth-btn';
        prodView.classList.add('hide');
        orderView.classList.remove('hide');
        loadAdminOrders();
    }
};

// Fetch and render products inside Admin Table
async function loadAdminProducts() {
    const list = document.getElementById('admin-products-list');
    list.innerHTML = `<tr><td colspan="7" style="text-align:center;">Loading products...</td></tr>`;

    try {
        const response = await fetch(`${API_URL}/api/Products?pageNumber=1&pageSize=100`);
        if (!response.ok) throw new Error('Failed to fetch products');
        const products = await response.json();

        if (products.length === 0) {
            list.innerHTML = `<tr><td colspan="7" style="text-align:center;">No products available.</td></tr>`;
            return;
        }

        list.innerHTML = products.map(p => `
            <tr>
                <td>${p.id}</td>
                <td><strong>${p.name}</strong></td>
                <td><span class="results-meta">${p.categoryName}</span></td>
                <td><span class="results-meta">${p.brandName}</span></td>
                <td>$${p.price.toFixed(2)}</td>
                <td>${p.stockQuantity}</td>
                <td>
                    <div class="action-btn-group">
                        <button class="btn-edit" onclick="openProductModal(${p.id})"><i class="fa-regular fa-pen-to-square"></i> Edit</button>
                        <button class="btn-delete" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')"><i class="fa-regular fa-trash-can"></i> Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        list.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--accent-red);">Failed to load products.</td></tr>`;
    }
}

// Open Product Form Modal in Create or Edit Mode
window.openProductModal = async (productId = null) => {
    const modalTitle = document.getElementById('product-modal-title');
    const form = document.getElementById('form-product');
    form.reset();

    if (productId === null) {
        // Create Mode
        modalTitle.textContent = 'Add New Product';
        document.getElementById('prod-id').value = '';
        openModal('product-modal');
    } else {
        // Edit Mode
        modalTitle.textContent = 'Edit Product';
        document.getElementById('prod-id').value = productId;
        
        try {
            const product = await apiCall(`/api/Products/${productId}`);
            document.getElementById('prod-name').value = product.name;
            document.getElementById('prod-desc').value = product.description;
            document.getElementById('prod-price').value = product.price;
            document.getElementById('prod-stock').value = product.stockQuantity;
            document.getElementById('prod-img').value = product.imageUrl;
            document.getElementById('prod-category').value = product.categoryId;
            document.getElementById('prod-brand').value = product.brandId;
            
            openModal('product-modal');
        } catch (err) {
            showToast('Failed to load product details.', 'error');
        }
    }
};

// Save Product (Create or Edit)
async function saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value;
    const description = document.getElementById('prod-desc').value;
    const price = parseFloat(document.getElementById('prod-price').value);
    const stockQuantity = parseInt(document.getElementById('prod-stock').value);
    const imageUrl = document.getElementById('prod-img').value;
    const categoryId = parseInt(document.getElementById('prod-category').value);
    const brandId = parseInt(document.getElementById('prod-brand').value);

    const payload = {
        name,
        description,
        price,
        imageUrl,
        stockQuantity,
        categoryId,
        brandId
    };

    try {
        if (!id) {
            await apiCall('/api/Products', 'POST', payload, true);
            showToast(`Product '${name}' created successfully.`);
        } else {
            payload.id = parseInt(id);
            await apiCall(`/api/Products/${id}`, 'PUT', payload, true);
            showToast(`Product '${name}' updated successfully.`);
        }
        closeModal('product-modal');
        loadAdminProducts();
        loadCatalog();
    } catch (err) {
        showToast(err.message || 'Failed to save product.', 'error');
    }
}

// Delete Product
window.deleteProduct = async (id, name) => {
    if (!confirm(`Are you sure you want to delete '${name}'?`)) return;

    try {
        await apiCall(`/api/Products/${id}`, 'DELETE', null, true);
        showToast(`Product '${name}' deleted successfully.`);
        loadAdminProducts();
        loadCatalog();
    } catch (err) {
        showToast(err.message || 'Failed to delete product.', 'error');
    }
};

// Fetch and render customer orders inside Admin Table
async function loadAdminOrders() {
    const list = document.getElementById('admin-orders-list');
    list.innerHTML = `<tr><td colspan="7" style="text-align:center;">Loading orders...</td></tr>`;

    try {
        const orders = await apiCall('/api/Orders/admin-all', 'GET', null, true);

        if (orders.length === 0) {
            list.innerHTML = `<tr><td colspan="7" style="text-align:center;">No orders placed yet.</td></tr>`;
            return;
        }

        list.innerHTML = orders.map(o => {
            const dateStr = new Date(o.orderDate).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const itemsList = o.orderItems.map(item => `
                <li>${item.productName} <strong>x${item.quantity}</strong></li>
            `).join('');

            // Status select choices
            const statuses = ['Pending', 'PaymentReceived', 'PaymentFailed', 'Shipped', 'Cancelled'];
            const selectOptions = statuses.map(s => `
                <option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>
            `).join('');

            return `
                <tr>
                    <td><strong>#${o.id}</strong></td>
                    <td>${dateStr}</td>
                    <td>${o.userId}</td>
                    <td><strong>$${o.total.toFixed(2)}</strong></td>
                    <td><span class="order-status-badge ${getStatusClass(o.status)}">${o.status}</span></td>
                    <td>
                        <ul class="admin-orders-items-list">
                            ${itemsList}
                        </ul>
                    </td>
                    <td>
                        <select class="status-select" onchange="updateOrderStatus(${o.id}, this.value)">
                            ${selectOptions}
                        </select>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        list.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--accent-red);">Failed to load orders.</td></tr>`;
    }
}

// Helper status CSS class mapper
function getStatusClass(status) {
    if (status === 'Completed' || status === 'Shipped' || status === 'PaymentReceived') return 'status-completed';
    if (status === 'Failed' || status === 'Cancelled' || status === 'PaymentFailed') return 'status-failed';
    return 'status-pending';
}

// Update order status via PUT API call
window.updateOrderStatus = async (orderId, newStatus) => {
    try {
        await apiCall(`/api/Orders/${orderId}/status/${newStatus}`, 'PUT', null, true);
        showToast(`Order #${orderId} status updated to ${newStatus}.`);
        loadAdminOrders();
    } catch (err) {
        showToast(err.message || 'Failed to update order status.', 'error');
    }
};
