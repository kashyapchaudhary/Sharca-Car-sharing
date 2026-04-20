import re

files = [
    "trips.html",
    "profile.html"
]

pattern = re.compile(r'(<a href="index\.html" onclick="logoutUser\(event\)">Logout</a>)')
replacement = r'<a href="help.html">Help</a>\n            \1'

for filename in files:
    with open(filename, "r") as f:
        content = f.read()
    
    if "help.html" not in content:
        content = pattern.sub(replacement, content)
        with open(filename, "w") as f:
            f.write(content)
        print(f"Patched {filename}")
    else:
        print(f"Already patched {filename}")

