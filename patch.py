with open("driver-earn.html", "r") as f:
    content = f.read()

target = r"""            rides.forEach(ride => {
                const platformFeePercent = 0.20;
                const pricePaidByUser = Number(ride.price || 0);
                const platformFeeAmount = pricePaidByUser * platformFeePercent;
                const driverNetEarning = pricePaidByUser - platformFeeAmount;

                totalWalletBalance += driverNetEarning;

                // Add to history list
                const card = document.createElement('div');
                card.className = 'transaction-item';
                const dateStr = ride.completed_at ? new Date(ride.completed_at).toLocaleString('en-IN', { month: 'short', day: 'numeric' }) : 'Today';
                
                card.innerHTML = `
                    <div class="transaction-left">
                        <div class="icon-circle icon-ride">🚗</div>
                        <div class="transaction-info">
                            <h4>Ride: ${ride.origin} to ${ride.destination}</h4>
                            <p>${dateStr} • Sharca Fee: -₹${platformFeeAmount.toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="transaction-amount">+₹${driverNetEarning.toFixed(2)}</div>
                `;
                historyContainer.appendChild(card);
            });

            // Prepare chart data
            ridesForChart.forEach(ride => {"""

replacement = r"""            rides.forEach(ride => {
                const platformFeePercent = 0.20;
                const pricePaidByUser = Number(ride.price || 0);
                const platformFeeAmount = pricePaidByUser * platformFeePercent;
                const driverNetEarning = pricePaidByUser - platformFeeAmount;
                const isPaid = ride.status === 'paid';

                if (isPaid) {
                    totalWalletBalance += driverNetEarning;
                }

                // Add to history list
                const card = document.createElement('div');
                card.className = 'transaction-item';
                const dateStr = ride.completed_at ? new Date(ride.completed_at).toLocaleString('en-IN', { month: 'short', day: 'numeric' }) : 'Today';
                const statusBadge = isPaid ? `<span style="background: rgba(46, 204, 113, 0.2); color: #2ecc71; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-left: 8px; vertical-align: middle;">PAID</span>` : `<span style="background: rgba(241, 196, 15, 0.2); color: #f39c12; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-left: 8px; vertical-align: middle;">PENDING</span>`;
                
                card.innerHTML = `
                    <div class="transaction-left">
                        <div class="icon-circle icon-ride" style="${isPaid ? '' : 'filter: grayscale(1); opacity: 0.7;'}">🚗</div>
                        <div class="transaction-info">
                            <h4>Ride: ${ride.origin} to ${ride.destination} ${statusBadge}</h4>
                            <p>${dateStr} • Sharca Fee: -₹${platformFeeAmount.toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="transaction-amount" style="${isPaid ? '' : 'color: #95a5a6;'}">+₹${driverNetEarning.toFixed(2)}</div>
                `;
                historyContainer.appendChild(card);
            });

            // Prepare chart data
            ridesForChart.filter(r => r.status === 'paid' || !r.status).forEach(ride => {"""

if target in content:
    content = content.replace(target, replacement)
    with open("driver-earn.html", "w") as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Target not found")
