import re

# 1. Update navigation bars to include History
files = [
    "home.html",
    "trips.html",
    "profile.html",
    "help.html"
]

pattern = re.compile(r'(<a href="profile\.html">Profile</a>)')
replacement = r'<a href="user-history.html">History</a>\n            \1'

for filename in files:
    with open(filename, "r") as f:
        content = f.read()
    
    if "user-history.html" not in content:
        content = pattern.sub(replacement, content)
        with open(filename, "w") as f:
            f.write(content)
        print(f"Patched nav in {filename}")

# 2. Update trips.html to filter out past trips
with open("trips.html", "r") as f:
    trips_content = f.read()

old_filter_block = """            const trips = await getSavedTrips();
            container.innerHTML = ''; 

            if (trips.length === 0) {"""

new_filter_block = """            const allTrips = await getSavedTrips();
            const trips = allTrips.filter(t => !['completed', 'paid', 'cancelled'].includes(t.status));
            container.innerHTML = ''; 

            if (trips.length === 0) {"""

trips_content = trips_content.replace(old_filter_block, new_filter_block)

with open("trips.html", "w") as f:
    f.write(trips_content)
    print("Patched renderTrips in trips.html")

