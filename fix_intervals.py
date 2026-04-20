with open("driver-dashboard.html", "r") as f:
    content = f.read()

# Replace all occurrences of the double call except the first one in DOMContentLoaded
content = content.replace("checkForActiveDriverRide();\n            setInterval(checkForActiveDriverRide, 3000);", "checkForActiveDriverRide();")

# Now re-add it ONLY inside DOMContentLoaded
target = """        document.addEventListener('DOMContentLoaded', () => {
            loadRequests();
            lookForNewRides();
            checkForActiveDriverRide();"""

new_target = """        document.addEventListener('DOMContentLoaded', () => {
            loadRequests();
            lookForNewRides();
            checkForActiveDriverRide();
            setInterval(checkForActiveDriverRide, 3000);"""

content = content.replace(target, new_target)

with open("driver-dashboard.html", "w") as f:
    f.write(content)
