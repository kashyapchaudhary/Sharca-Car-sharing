with open("supabase-schema.sql", "r") as f:
    content = f.read()

content = content.replace(
    "ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;",
    "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;"
)
content = content.replace(
    "ALTER TABLE public.trip_bookings ADD COLUMN payment_method TEXT;",
    "ALTER TABLE public.trip_bookings ADD COLUMN IF NOT EXISTS payment_method TEXT;"
)

with open("supabase-schema.sql", "w") as f:
    f.write(content)

print("Schema patched")
