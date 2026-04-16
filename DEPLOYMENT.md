# Sharca Deployment and Backend Setup

## 1) Deploy to Netlify
1. Push this project to a Git repository.
2. In Netlify, choose **Add new site** -> **Import from Git**.
3. Set:
   - Build command: *(leave empty)*
   - Publish directory: `.`
4. Deploy site.

## 2) Create Supabase backend
1. Create a Supabase project.
2. Open SQL Editor and run `supabase-schema.sql`.
   - This now creates `profiles`, `ride_offers`, and `trip_bookings`.
3. In Project Settings -> API, copy:
   - Project URL
   - Anon public key

## 3) Configure frontend
1. Open `supabase-config.js`.
2. Replace:
   - `url` with your Supabase project URL
   - `anonKey` with your public anon key

## 4) Redeploy
- Commit and push changes. Netlify redeploys automatically.

## 5) Verify MVP
- Signup as Rider -> redirect to `home.html`
- Signup as Driver -> redirect to `driver-dashboard.html`
- Logout -> redirect to `index.html`
- Open protected page directly while logged out -> redirect to `index.html`
- Driver publishes a ride -> rider can find it in search
- Rider books a ride -> driver sees the pending request
- Driver accepts/completes ride -> rider trips and driver earnings update
