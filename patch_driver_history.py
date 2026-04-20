import re

files = [
    "driver-dashboard.html",
    "driver-add-ride.html",
    "driver-earn.html",
    "driver-profile.html",
    "driver-help.html"
]

pattern = re.compile(r'(<a href="driver-profile\.html">Profile</a>)')
replacement = r'<a href="driver-history.html">History</a>\n            \1'

for filename in files:
    with open(filename, "r") as f:
        content = f.read()
    
    if "driver-history.html" not in content:
        content = pattern.sub(replacement, content)
        with open(filename, "w") as f:
            f.write(content)
        print(f"Patched nav in {filename}")

