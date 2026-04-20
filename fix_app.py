with open("app.js", "r") as f:
    content = f.read()

bad_block = """            }, 1500);
        });
                
            }, 1500);
        });"""

good_block = """            }, 1500);
        });"""

if bad_block in content:
    content = content.replace(bad_block, good_block)
    with open("app.js", "w") as f:
        f.write(content)
    print("Fixed duplication in app.js")
else:
    print("Duplication not found.")

