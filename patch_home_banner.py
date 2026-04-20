with open("home.html", "r") as f:
    content = f.read()

# 1. Add CSS
css_to_add = """    <style>
        .payment-banner {
            background: linear-gradient(135deg, #e67e22, #f39c12);
            color: white;
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 15px rgba(230, 126, 34, 0.4);
            animation: slideDown 0.5s ease;
            position: relative;
            z-index: 99;
        }
        .payment-banner-info h3 { margin: 0; font-size: 18px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
        .payment-banner-info p { margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; }
        .btn-banner-pay {
            background: white;
            color: #e67e22;
            border: none;
            padding: 10px 25px;
            border-radius: 20px;
            font-weight: 800;
            font-size: 16px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        .btn-banner-pay:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.15);
        }
    </style>
</head>"""

if "payment-banner" not in content:
    content = content.replace("</head>", css_to_add)

# 2. Add Banner HTML right after <header>
html_to_add = """    </header>

    <div id="payment-banner-container" style="display: none;"></div>
"""

if "payment-banner-container" not in content:
    content = content.replace("    </header>", html_to_add)

# 3. Add JS logic
js_to_add = """        document.addEventListener('DOMContentLoaded', async () => {
            if(typeof setupAutocomplete === 'function') {
                setupAutocomplete('origin');
                setupAutocomplete('destination');
            }
            
            // Check for pending payments
            try {
                if (typeof isSupabaseConfigured === 'function' && isSupabaseConfigured()) {
                    const trips = await fetchRiderTrips();
                    const unpaidTrip = trips.find(t => t.status === 'completed');
                    
                    if (unpaidTrip) {
                        const bannerContainer = document.getElementById('payment-banner-container');
                        bannerContainer.innerHTML = `
                            <div class="payment-banner">
                                <div class="payment-banner-info">
                                    <h3>⚠️ Payment Required</h3>
                                    <p>Your ride from ${unpaidTrip.origin} to ${unpaidTrip.destination} is complete. Please pay the driver.</p>
                                </div>
                                <button class="btn-banner-pay" onclick="window.location.href='user-payment.html?bookingId=${unpaidTrip.id}'">Pay ₹${unpaidTrip.price || 0}</button>
                            </div>
                        `;
                        bannerContainer.style.display = 'block';
                    }
                }
            } catch (err) {
                console.error("Failed to fetch trips for payment check:", err);
            }
        });"""

old_js = """        document.addEventListener('DOMContentLoaded', () => {
            if(typeof setupAutocomplete === 'function') {
                setupAutocomplete('origin');
                setupAutocomplete('destination');
            }
        });"""

if "checkPendingPayments" not in content and old_js in content:
    content = content.replace(old_js, js_to_add)

with open("home.html", "w") as f:
    f.write(content)
print("home.html patched with payment banner.")
