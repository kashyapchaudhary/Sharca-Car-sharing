import re

with open("driver-earn.html", "r") as f:
    content = f.read()

pattern = re.compile(
    r"totalWalletBalance \+= driverNetEarning;(.*?)<div class=\"transaction-amount\">\+₹\$\{driverNetEarning\.toFixed\(2\)\}<\/div>(.*?)ridesForChart\.forEach\(ride => \{",
    re.DOTALL
)

replacement = r"""const isPaid = ride.status === 'paid';

                if (isPaid) {
                    totalWalletBalance += driverNetEarning;
                }\1<div class="transaction-amount" style="${isPaid ? '' : 'color: #95a5a6;'}">+₹${driverNetEarning.toFixed(2)}</div>\2ridesForChart.filter(r => r.status === 'paid' || !r.status).forEach(ride => {"""

content = pattern.sub(replacement, content)

# Also need to add the badge to the h4
pattern_h4 = re.compile(r"<h4>Ride: \$\{ride\.origin\} to \$\{ride\.destination\}</h4>")
replacement_h4 = r"""<h4>Ride: ${ride.origin} to ${ride.destination} ${isPaid ? `<span style="background: rgba(46, 204, 113, 0.2); color: #2ecc71; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-left: 8px; vertical-align: middle;">PAID</span>` : `<span style="background: rgba(241, 196, 15, 0.2); color: #f39c12; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; margin-left: 8px; vertical-align: middle;">PENDING</span>`}</h4>"""
content = pattern_h4.sub(replacement_h4, content)

# Also need to make the icon grey if unpaid
pattern_icon = re.compile(r"<div class=\"icon-circle icon-ride\">🚗</div>")
replacement_icon = r"""<div class="icon-circle icon-ride" style="${isPaid ? '' : 'filter: grayscale(1); opacity: 0.7;'}">🚗</div>"""
content = pattern_icon.sub(replacement_icon, content)

with open("driver-earn.html", "w") as f:
    f.write(content)

print("Driver earn patched")
