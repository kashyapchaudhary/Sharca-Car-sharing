# 1. Patch trips.html
with open("trips.html", "r") as f:
    content = f.read()

# Add polling
if "setInterval(checkForActiveRide, 3000);" not in content:
    content = content.replace("checkForActiveRide();", "checkForActiveRide();\n            setInterval(checkForActiveRide, 3000);")

# Update checkForActiveRide logic
old_func = """        async function checkForActiveRide() {
            const trips = await getSavedTrips();
            const activeRide = trips.find(t => t.status === 'accepted');
            
            if (activeRide) {"""

new_func = """        async function checkForActiveRide() {
            if (window.isAnimatingMap) return;
            const trips = await getSavedTrips();
            const activeRide = trips.find(t => t.status === 'accepted');
            
            if (activeRide) {"""

if "if (window.isAnimatingMap) return;" not in content:
    content = content.replace(old_func, new_func)

with open("trips.html", "w") as f:
    f.write(content)

# 2. Patch driver-dashboard.html
with open("driver-dashboard.html", "r") as f:
    content = f.read()

# Add polling
if "setInterval(checkForActiveDriverRide, 3000);" not in content:
    content = content.replace("checkForActiveDriverRide();", "checkForActiveDriverRide();\n            setInterval(checkForActiveDriverRide, 3000);")

# Update checkForActiveDriverRide logic
old_func_driver = """        async function checkForActiveDriverRide() {
            const trips = await fetchDriverBookings(['accepted']);
            if (trips && trips.length > 0) {"""

new_func_driver = """        async function checkForActiveDriverRide() {
            if (window.isAnimatingMap) return;
            const trips = await fetchDriverBookings(['accepted']);
            if (trips && trips.length > 0) {"""

if "if (window.isAnimatingMap) return;" not in content:
    content = content.replace(old_func_driver, new_func_driver)

with open("driver-dashboard.html", "w") as f:
    f.write(content)

print("Polling patched.")
