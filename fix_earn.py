import re

with open("driver-earn.html", "r") as f:
    content = f.read()

# Replace the rides.forEach block
old_block = """            rides.forEach(ride => {
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
                        <div class="icon-circle icon-ride" style="${isPaid ? '' : 'filter: grayscale(1); opacity: 0.7;'}">🚗</div>
                        <div class="transaction-info">
                            <h4>Ride: ${ride.origin} to ${ride.destination}</h4>
                            <p>${dateStr} • Sharca Fee: -₹${platformFeeAmount.toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="transaction-amount">+₹${driverNetEarning.toFixed(2)}</div>
                `;
                historyContainer.appendChild(card);
            });"""

new_block = """            rides.forEach(ride => {
                const isPaid = ride.status === 'paid';
                const platformFeePercent = 0.20;
                const pricePaidByUser = Number(ride.price || 0);
                const platformFeeAmount = pricePaidByUser * platformFeePercent;
                const driverNetEarning = pricePaidByUser - platformFeeAmount;

                if (isPaid) {
                    totalWalletBalance += driverNetEarning;
                }

                // Add to history list
                const card = document.createElement('div');
                card.className = 'transaction-item';
                const dateStr = ride.completed_at ? new Date(ride.completed_at).toLocaleString('en-IN', { month: 'short', day: 'numeric' }) : 'Today';
                const badge = isPaid ? '<span class="status-badge paid" style="font-size:10px; background:#e8f8f5; color:#2ecc71; padding:2px 6px; border-radius:4px; vertical-align:middle; margin-left:5px;">PAID</span>' : '<span class="status-badge pending" style="font-size:10px; background:#fef5e7; color:#f39c12; padding:2px 6px; border-radius:4px; vertical-align:middle; margin-left:5px;">PENDING</span>';
                
                card.innerHTML = `
                    <div class="transaction-left">
                        <div class="icon-circle icon-ride" style="${isPaid ? '' : 'filter: grayscale(1); opacity: 0.7;'}">🚗</div>
                        <div class="transaction-info">
                            <h4 style="margin:0; font-size:16px;">Ride: ${ride.origin} to ${ride.destination} ${badge}</h4>
                            <p style="margin:5px 0 0 0; color:#7f8c8d; font-size:13px;">${dateStr} • Sharca Fee: -₹${platformFeeAmount.toFixed(2)}</p>
                        </div>
                    </div>
                    <div class="transaction-amount" style="${isPaid ? '' : 'color:#95a5a6; font-weight:500; font-size:16px;'}">+₹${driverNetEarning.toFixed(2)}</div>
                `;
                historyContainer.appendChild(card);
            });"""

content = content.replace(old_block, new_block)

# Fix chart data to only include paid
old_chart = """            ridesForChart.forEach(ride => {
                const dateStr = ride.completed_at ? new Date(ride.completed_at).toLocaleString('en-IN', { month: 'short', day: 'numeric' }) : 'Today';
                const driverNet = Number(ride.price || 0) * 0.8;
                
                if(earningsByDay[dateStr]) {
                    earningsByDay[dateStr] += driverNet;
                } else {
                    earningsByDay[dateStr] = driverNet;
                }
            });"""

new_chart = """            ridesForChart.forEach(ride => {
                if (ride.status !== 'paid') return;
                const dateStr = ride.completed_at ? new Date(ride.completed_at).toLocaleString('en-IN', { month: 'short', day: 'numeric' }) : 'Today';
                const driverNet = Number(ride.price || 0) * 0.8;
                
                if(earningsByDay[dateStr]) {
                    earningsByDay[dateStr] += driverNet;
                } else {
                    earningsByDay[dateStr] = driverNet;
                }
            });"""

content = content.replace(old_chart, new_chart)

with open("driver-earn.html", "w") as f:
    f.write(content)

print("driver-earn.html fixed")
