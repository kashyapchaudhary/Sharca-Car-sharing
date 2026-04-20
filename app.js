// ==========================================
// --- 1. AUTHENTICATION LOGIC (index.html) ---
// ==========================================
let isSignup = false;
let currentRole = 'user'; 
const SESSION_KEY = 'sharcaSession';
const PROFILE_KEY = 'sharcaProfile';
const supabaseClient = window.getSupabaseClient ? window.getSupabaseClient() : null;

function isSupabaseConfigured() {
    return Boolean(supabaseClient);
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
    return password.length >= 6;
}

function setAuthMessage(type, message) {
    const messageBox = document.getElementById('auth-message');
    if (!messageBox) return;

    messageBox.className = 'auth-message';
    messageBox.classList.add(type);
    messageBox.textContent = message;
}

function clearAuthMessage() {
    const messageBox = document.getElementById('auth-message');
    if (!messageBox) return;

    messageBox.className = 'auth-message';
    messageBox.textContent = '';
}

function navigateByRole(role) {
    if (role === 'driver') {
        window.location.href = 'driver-dashboard.html';
    } else {
        window.location.href = 'home.html';
    }
}

function saveSession(account, rememberSession) {
    const sessionData = {
        id: account.id || null,
        name: account.name,
        email: account.email,
        role: account.role,
        phone: account.phone || '',
        car: account.car || '',
        plate: account.plate || '',
        avatar_url: account.avatar_url || '',
        isLoggedIn: true,
        loginAt: new Date().toISOString(),
        persistent: Boolean(rememberSession)
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    localStorage.setItem(PROFILE_KEY, JSON.stringify(sessionData));
}

async function getSupabaseSession() {
    if (!isSupabaseConfigured()) {
        return null;
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error || !data.session) {
        return null;
    }

    return data.session;
}

async function fetchProfileByUserId(userId) {
    if (!isSupabaseConfigured() || !userId) {
        return null;
    }

    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, name, role, phone, car, plate, avatar_url')
        .eq('id', userId)
        .single();

    if (error) {
        return null;
    }

    return data;
}

async function hydrateSessionFromSupabase() {
    const session = await getSupabaseSession();
    if (!session || !session.user) {
        return null;
    }

    const profile = await fetchProfileByUserId(session.user.id);
    if (!profile || !profile.role) {
        return null;
    }

    saveSession({
        id: session.user.id,
        name: profile.name || session.user.email || 'Sharca User',
        email: session.user.email || '',
        role: profile.role,
        phone: profile.phone || '',
        car: profile.car || '',
        plate: profile.plate || '',
        avatar_url: profile.avatar_url || ''
    }, true);

    return getStoredSession();
}

async function checkExistingSession() {
    if (isSupabaseConfigured()) {
        const session = await hydrateSessionFromSupabase();
        if (session && session.role) {
            navigateByRole(session.role);
        }
        return;
    }

    const rawSession = localStorage.getItem(SESSION_KEY);
    if (!rawSession) return;

    try {
        const session = JSON.parse(rawSession);
        if (session && session.isLoggedIn && session.role) {
            navigateByRole(session.role);
        }
    } catch (error) {
        localStorage.removeItem(SESSION_KEY);
    }
}

function getCurrentPage() {
    const path = window.location.pathname;
    const fileName = path.substring(path.lastIndexOf('/') + 1);
    return fileName || 'index.html';
}

function getStoredSession() {
    const rawSession = localStorage.getItem(SESSION_KEY);
    if (!rawSession) return null;

    try {
        const session = JSON.parse(rawSession);
        if (!session || !session.isLoggedIn || !session.role) {
            return null;
        }
        return session;
    } catch (error) {
        localStorage.removeItem(SESSION_KEY);
        return null;
    }
}

function getCachedProfile() {
    const rawProfile = localStorage.getItem(PROFILE_KEY);
    if (!rawProfile) {
        return {};
    }

    try {
        return JSON.parse(rawProfile);
    } catch (error) {
        return {};
    }
}

async function requireUserSession() {
    if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured yet.');
    }

    const session = await getActiveSession();
    if (!session || !session.id) {
        throw new Error('You must be logged in to continue.');
    }
    return session;
}

async function fetchRideOffers(filters = {}) {
    if (!isSupabaseConfigured()) {
        return [];
    }

    let query = supabaseClient
        .from('ride_offers')
        .select('*')
        .order('created_at', { ascending: false });

    if (filters.driverId) {
        query = query.eq('driver_id', filters.driverId);
    }

    if (filters.status) {
        query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Ride fetch failed:', error.message);
        return [];
    }

    return data || [];
}

async function createRideOfferRecord(rideInput) {
    const session = await requireUserSession();
    const profile = getCachedProfile();
    const payload = {
        driver_id: session.id,
        driver_name: profile.name || session.name || 'Sharca Driver',
        car_details: profile.car || '',
        origin: rideInput.origin,
        destination: rideInput.destination,
        ride_date: rideInput.date,
        ride_time: rideInput.time,
        seats_left: rideInput.seatsLeft,
        price: rideInput.price,
        status: 'active'
    };

    const { error } = await supabaseClient.from('ride_offers').insert(payload);
    if (error) {
        throw error;
    }
}

async function deleteRideOfferRecord(rideId) {
    const { error } = await supabaseClient.from('ride_offers').delete().eq('id', rideId);
    if (error) {
        throw error;
    }
}

async function createTripBookingRecord(ride) {
    const session = await requireUserSession();
    const { data: latestRide, error: rideError } = await supabaseClient
        .from('ride_offers')
        .select('*')
        .eq('id', ride.id)
        .single();

    if (rideError || !latestRide) {
        throw new Error('Ride is no longer available.');
    }

    if (latestRide.seats_left < 1 || latestRide.status !== 'active') {
        throw new Error('No seats are available on this ride.');
    }

    const { data: booking, error: bookingError } = await supabaseClient
        .from('trip_bookings')
        .insert({
            ride_offer_id: latestRide.id,
            rider_id: session.id,
            driver_id: latestRide.driver_id,
            origin: ride.origin,
            destination: ride.destination,
            trip_date: ride.date || null,
            trip_time: ride.time || '',
            price: ride.price || 0,
            status: 'pending',
            driver_name: ride.driver || latestRide.driver_name || '',
            car_details: ride.car || latestRide.car_details || ''
        })
        .select()
        .single();

    if (bookingError) {
        throw bookingError;
    }

    const { error: updateError } = await supabaseClient
        .from('ride_offers')
        .update({ seats_left: latestRide.seats_left - 1 })
        .eq('id', latestRide.id);

    if (updateError) {
        throw updateError;
    }

    return booking;
}

async function fetchRiderTrips() {
    const session = await requireUserSession();
    const { data, error } = await supabaseClient
        .from('trip_bookings')
        .select('*')
        .eq('rider_id', session.id)
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Trip fetch failed:', error.message);
        return [];
    }

    return data || [];
}

async function createManualTripRecord(trip) {
    const session = await requireUserSession();
    const { error } = await supabaseClient.from('trip_bookings').insert({
        rider_id: session.id,
        origin: trip.origin,
        destination: trip.destination,
        trip_date: trip.date || null,
        status: 'saved'
    });

    if (error) {
        throw error;
    }
}

async function updateTripRecord(tripId, fields) {
    const { error } = await supabaseClient.from('trip_bookings').update(fields).eq('id', tripId);
    if (error) {
        throw error;
    }
}

async function cancelTripRecord(trip) {
    if (trip.status === 'completed') {
        throw new Error('Completed rides cannot be cancelled.');
    }

    if (trip.ride_offer_id) {
        const { data: offer } = await supabaseClient
            .from('ride_offers')
            .select('id, seats_left')
            .eq('id', trip.ride_offer_id)
            .single();

        if (offer) {
            await supabaseClient
                .from('ride_offers')
                .update({ seats_left: offer.seats_left + 1 })
                .eq('id', offer.id);
        }
    }

    const { error } = await supabaseClient
        .from('trip_bookings')
        .update({ status: 'cancelled' })
        .eq('id', trip.id);

    if (error) {
        throw error;
    }
}

async function fetchDriverBookings(statuses) {
    const session = await requireUserSession();
    const { data, error } = await supabaseClient
        .from('trip_bookings')
        .select('*')
        .eq('driver_id', session.id)
        .in('status', statuses)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Driver booking fetch failed:', error.message);
        return [];
    }

    return data || [];
}

async function acceptTripRecord(bookingId) {
    const session = await requireUserSession();
    const profile = getCachedProfile();
    const { error } = await supabaseClient
        .from('trip_bookings')
        .update({
            status: 'accepted',
            driver_id: session.id,
            driver_name: profile.name || 'Sharca Driver',
            car_details: profile.car || ''
        })
        .eq('id', bookingId);

    if (error) {
        throw error;
    }
}

async function completeTripRecord(booking) {
    const { error } = await supabaseClient
        .from('trip_bookings')
        .update({
            status: 'completed',
            completed_at: new Date().toISOString()
        })
        .eq('id', booking.id);

    if (error) {
        throw error;
    }
}

async function fetchDriverCompletedTrips() {
    return fetchDriverBookings(['completed', 'paid']);
}

async function getActiveSession() {
    if (isSupabaseConfigured()) {
        return hydrateSessionFromSupabase();
    }
    return getStoredSession();
}

async function enforceSessionGuard() {
    const currentPage = getCurrentPage();
    const protectedPageRoles = {
        'home.html': ['user'],
        'trips.html': ['user'],
        'profile.html': ['user'],
        'driver-dashboard.html': ['driver'],
        'driver-add-ride.html': ['driver'],
        'driver-earn.html': ['driver'],
        'driver-profile.html': ['driver'],
        'help.html': ['user', 'driver']
    };

    if (currentPage === 'index.html') {
        await checkExistingSession();
        return;
    }

    const allowedRoles = protectedPageRoles[currentPage];
    if (!allowedRoles) {
        return;
    }

    const session = await getActiveSession();
    if (!session) {
        window.location.href = 'index.html';
        return;
    }

    if (!allowedRoles.includes(session.role)) {
        navigateByRole(session.role);
    }
}

window.logoutUser = function(event) {
    if (event) {
        event.preventDefault();
    }

    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(PROFILE_KEY);

    if (isSupabaseConfigured()) {
        supabaseClient.auth.signOut().finally(() => {
            window.location.href = 'index.html';
        });
        return;
    }

    window.location.href = 'index.html';
}

function setRole(role) {
    currentRole = role; 
    
    if(document.getElementById('btn-user')) {
        document.getElementById('btn-user').classList.remove('active');
        document.getElementById('btn-driver').classList.remove('active');
        document.getElementById(`btn-${role}`).classList.add('active');
    }
}

function toggleSignup() {
    isSignup = !isSignup;
    
    if(document.getElementById('auth-title')) {
        document.getElementById('auth-title').innerText = isSignup ? 'Create an Account' : 'Login';
        document.getElementById('auth-submit-btn').innerText = isSignup ? 'Sign Up' : 'Enter App';
        
        const toggleLink = document.querySelector('.toggle-link');
        toggleLink.innerText = isSignup ? 'Already have an account? Login' : "Don't have an account? Sign Up";

        const nameField = document.getElementById('name-field');
        const nameInput = document.getElementById('auth-name');
        if (isSignup) {
            nameField.classList.remove('hidden');
            nameInput.setAttribute('required', 'true');
        } else {
            nameField.classList.add('hidden');
            nameInput.removeAttribute('required');
        }

        clearAuthMessage();
    }
}

async function handleAuth(event) {
    event.preventDefault(); 

    const nameInput = document.getElementById('auth-name');
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    const rememberInput = document.getElementById('remember-session');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const rememberSession = rememberInput ? rememberInput.checked : true;

    if (!validateEmail(email)) {
        setAuthMessage('error', 'Please enter a valid email address.');
        return;
    }

    if (!validatePassword(password)) {
        setAuthMessage('error', 'Password must be at least 6 characters.');
        return;
    }

    if (isSignup) {
        if (!name) {
            setAuthMessage('error', 'Please enter your full name.');
            return;
        }

        if (!isSupabaseConfigured()) {
            setAuthMessage('error', 'Backend is not configured yet. Add your Supabase URL and anon key in supabase-config.js.');
            return;
        }

        const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
            email,
            password
        });

        if (signUpError) {
            setAuthMessage('error', signUpError.message);
            return;
        }

        if (!signUpData.user) {
            setAuthMessage('error', 'Signup failed. Please try again.');
            return;
        }

        if (!signUpData.session) {
            setAuthMessage('error', 'Please verify your email address to continue, or disable Email Confirmations in Supabase settings.');
            return;
        }

        const { error: profileError } = await supabaseClient.from('profiles').upsert({
            id: signUpData.user.id,
            name,
            role: currentRole,
            phone: '',
            car: '',
            plate: '',
            avatar_url: ''
        });

        if (profileError) {
            setAuthMessage('error', profileError.message);
            return;
        }

        saveSession({
            id: signUpData.user.id,
            name,
            email,
            role: currentRole,
            phone: '',
            car: '',
            plate: '',
            avatar_url: ''
        }, rememberSession);
        
        // Clear out old demo data so it's a fresh account
        localStorage.removeItem('sharcaTrips');
        localStorage.removeItem('sharcaCurrentRide');
        localStorage.removeItem('sharcaOfferedRides');
        localStorage.removeItem('sharcaCompletedRides');

        setAuthMessage('success', `Welcome ${name}. Your ${currentRole} account is ready.`);
        setTimeout(() => navigateByRole(currentRole), 500);
    } else {
        if (!isSupabaseConfigured()) {
            setAuthMessage('error', 'Backend is not configured yet. Add your Supabase URL and anon key in supabase-config.js.');
            return;
        }

        const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (signInError || !signInData.user) {
            setAuthMessage('error', signInError ? signInError.message : 'Invalid login credentials.');
            return;
        }

        const profile = await fetchProfileByUserId(signInData.user.id);
        if (!profile) {
            setAuthMessage('error', 'Profile not found. Please contact support.');
            return;
        }

        if (profile.role !== currentRole) {
            setAuthMessage('error', `This account is registered as ${profile.role}. Please switch role tab.`);
            return;
        }

        saveSession({
            id: signInData.user.id,
            name: profile.name || signInData.user.email,
            email: signInData.user.email || email,
            role: profile.role,
            phone: profile.phone || '',
            car: profile.car || '',
            plate: profile.plate || ''
        }, rememberSession);
        setAuthMessage('success', `Login successful. Redirecting to your ${currentRole} dashboard...`);
        setTimeout(() => navigateByRole(currentRole), 400);
    }
}

// ==========================================
// --- PAGE INITIALIZATION (Runs on load) ---
// ==========================================
let map;
let routingControl;

document.addEventListener('DOMContentLoaded', async () => {
    await enforceSessionGuard();

    // 1. Initialize Map for Users
    if (document.getElementById('map')) {
        map = L.map('map').setView([22.2587, 71.1924], 7); 
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }

    // 2. Load Profile Data
    if (document.getElementById('profile-name')) {
        loadProfile();
    }

    // 3. Start looking for rides on Driver Dashboard
    if (document.getElementById('incoming-request')) {
        lookForNewRides();
    }
});

// ==========================================
// --- 2. USER RIDE BOOKING (home.html) ---
// ==========================================

async function calculateRoute() {
    const origin = document.getElementById('origin').value;
    const destination = document.getElementById('destination').value;
    const searchBtn = document.getElementById('search-btn');

    if (!origin || !destination) {
        alert("Please enter both departure and destination.");
        return;
    }

    searchBtn.innerText = "Searching...";
    document.getElementById('available-rides-container').innerHTML = ''; 
    
    const confirmationDiv = document.getElementById('booking-confirmation');
    if (confirmationDiv) confirmationDiv.classList.add('hidden');

    try {
        const originRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(origin)}`);
        const originData = await originRes.json();
        
        const destRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}`);
        const destData = await destRes.json();

        if (originData.length === 0 || destData.length === 0) {
            alert("Could not find one of the locations. Try adding a broader region (e.g., 'Gujarat').");
            searchBtn.innerText = "Search Ride";
            return;
        }

        const startLatLng = L.latLng(originData[0].lat, originData[0].lon);
        const endLatLng = L.latLng(destData[0].lat, destData[0].lon);

        if (routingControl) {
            map.removeControl(routingControl);
        }

        routingControl = L.Routing.control({
            waypoints: [startLatLng, endLatLng],
            routeWhileDragging: false,
            addWaypoints: false,
            show: false 
        }).addTo(map);

        routingControl.on('routesfound', async function(e) {
            const routes = e.routes;
            const distanceKm = (routes[0].summary.totalDistance / 1000).toFixed(1);

            const allPublishedRides = isSupabaseConfigured()
                ? await fetchRideOffers({ status: 'active' })
                : [];

            const availableRides = allPublishedRides.filter(ride => {
                const matchOrigin = ride.origin.toLowerCase().includes(origin.toLowerCase()) || origin.toLowerCase().includes(ride.origin.toLowerCase());
                const matchDest = ride.destination.toLowerCase().includes(destination.toLowerCase()) || destination.toLowerCase().includes(ride.destination.toLowerCase());
                return matchOrigin && matchDest && ride.seats_left > 0;
            });

            if (availableRides.length > 0) {
                const formattedRides = availableRides.map(ride => ({
                    ...ride,
                    driver: ride.driver_name || "Sharca Driver",
                    rating: "4.9",
                    car: ride.car_details || "Standard Sedan",
                    seatsLeft: ride.seats_left,
                    date: ride.ride_date,
                    time: ride.ride_time
                }));

                renderAvailableRides(formattedRides, origin, destination, distanceKm);
            } else {
                document.getElementById('available-rides-container').innerHTML = `
                    <div style="text-align: center; padding: 30px; background: #fff; border-radius: 12px; border: 1px solid #dfe6e9;">
                        <h3 style="color: #e74c3c; margin-top: 0;">No Rides Found 😔</h3>
                        <p style="color: #7f8c8d;">We couldn't find any drivers heading from <strong>${origin}</strong> to <strong>${destination}</strong> right now.</p>
                    </div>
                `;
            }

            searchBtn.innerText = "Search Ride"; 
        });

        routingControl.on('routingerror', function() {
            alert("Could not calculate a driving route between these two locations.");
            searchBtn.innerText = "Search Ride";
        });

    } catch (error) {
        alert("An error occurred. Please check your internet connection.");
        console.error(error);
        searchBtn.innerText = "Search Ride";
    }
}

function renderAvailableRides(rides, origin, destination, distance) {
    const container = document.getElementById('available-rides-container');
    container.innerHTML = `<div style="grid-column: 1 / -1;"><h2 style="color: #2c3e50; margin-bottom: 5px; font-weight: 800; font-size: 2rem;">Available Rides <span style="color:#7f8c8d; font-size: 1.2rem; font-weight: 400;">(${distance} km)</span></h2></div>`;

    rides.forEach((ride) => {
        const rideCard = document.createElement('div');
        rideCard.className = 'ride-card-modern';

        const rideDataString = encodeURIComponent(JSON.stringify({ ...ride, origin, destination }));
        const seatsClass = ride.seatsLeft === 1 ? 'seats low' : 'seats';

        rideCard.innerHTML = `
            <div class="ride-info">
                <h4>
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #3498db;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    ${ride.driver}
                </h4>
                <div class="rating">⭐ ${ride.rating}</div>
                <p>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M14 15h.01"></path><path d="M10 15h.01"></path><path d="M19 11v-4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"></path></svg>
                    ${ride.car}
                </p>
                <p style="font-weight: 600; color: #34495e; margin-top: 15px;">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #2ecc71;"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                    Departure: ${ride.time}
                </p>
            </div>
            
            <div class="ride-price">
                <h2>₹${ride.price}</h2>
                <div class="${seatsClass}">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    ${ride.seatsLeft} seat${ride.seatsLeft > 1 ? 's' : ''} left
                </div>
                <button onclick="confirmCarpoolBooking('${rideDataString}')" class="modern-btn-black">Book Seat</button>
            </div>
        `;
        container.appendChild(rideCard);
    });
}

window.confirmCarpoolBooking = async function(encodedRideData) {
    const ride = JSON.parse(decodeURIComponent(encodedRideData));
    document.getElementById('available-rides-container').innerHTML = '';

    try {
        const booking = await createTripBookingRecord(ride);
        const confirmationDiv = document.getElementById('booking-confirmation');
        confirmationDiv.innerHTML = `
            <div style="text-align: center;">
                <h3 style="color: #f39c12; margin-top: 0; font-size: 1.8rem; font-weight: 800;">Requesting Seat...</h3>
                <p style="font-size: 1.1rem; color: #7f8c8d;">Sending your request to <strong style="color: #2c3e50;">${ride.driver}</strong> for the ${ride.time} ride.</p>
            </div>
        `;
        confirmationDiv.classList.remove('hidden');
        waitForDriver(booking.id);
    } catch (error) {
        alert(error.message || 'Unable to book this ride right now.');
        document.getElementById('booking-confirmation').classList.add('hidden');
    }
}

function waitForDriver(bookingId) {
    const checkInterval = setInterval(async () => {
        if (!isSupabaseConfigured()) {
            clearInterval(checkInterval);
            return;
        }

        const { data: rideData } = await supabaseClient
            .from('trip_bookings')
            .select('*')
            .eq('id', bookingId)
            .single();

        if (rideData && rideData.status === 'accepted') {
            clearInterval(checkInterval); 
            
            const confirmationDiv = document.getElementById('booking-confirmation');
            if(confirmationDiv) {
                confirmationDiv.innerHTML = `
                    <div style="text-align: center;">
                        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="#2ecc71" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 10px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <h2 style="color: #2c3e50; margin-top: 0; font-weight: 800; font-size: 2rem;">Ride Confirmed!</h2>
                        <p style="font-size: 1.2rem; color: #7f8c8d; margin-bottom: 5px;">Your driver, <strong style="color: #2c3e50;">${rideData.driver_name}</strong>, is arriving soon.</p>
                        <p style="color: #95a5a6; margin-top: 0;">Vehicle: <strong>${rideData.car_details}</strong></p>
                    </div>
                `;
            }
        }
    }, 1000);
}

// ==========================================
// --- 3. PROFILE MANAGEMENT (profile.html) ---
// ==========================================

window.saveProfile = function(event) {
    event.preventDefault(); 

    const profileData = {
        name: document.getElementById('profile-name').value,
        email: document.getElementById('profile-email').value,
        phone: document.getElementById('profile-phone').value,
        car: document.getElementById('profile-car') ? document.getElementById('profile-car').value : '',
        plate: document.getElementById('profile-plate') ? document.getElementById('profile-plate').value : ''
    };

    localStorage.setItem(PROFILE_KEY, JSON.stringify(profileData));

    if (isSupabaseConfigured()) {
        const session = getStoredSession();
        if (session && session.id) {
            supabaseClient.from('profiles').update({
                name: profileData.name,
                phone: profileData.phone,
                car: profileData.car,
                plate: profileData.plate
            }).eq('id', session.id).then(({ error }) => {
                if (error) {
                    console.error('Profile sync failed:', error.message);
                }
            });
        }
    }

    document.getElementById('display-name').innerText = profileData.name;
    if(profileData.name.length > 0) {
        document.getElementById('avatar-initial').innerText = profileData.name.charAt(0).toUpperCase();
    }

    const successMsg = document.getElementById('profile-success');
    successMsg.classList.remove('hidden');
    
    setTimeout(() => {
        successMsg.classList.add('hidden');
    }, 3000);
}

window.loadProfile = async function() {
    const session = getStoredSession();

    if (isSupabaseConfigured() && session && session.id) {
        const profile = await fetchProfileByUserId(session.id);
        if (profile) {
            const mergedProfile = {
                ...session,
                ...profile,
                email: session.email || ''
            };
            localStorage.setItem(PROFILE_KEY, JSON.stringify(mergedProfile));
        }
    }

    const savedData = localStorage.getItem(PROFILE_KEY);
    if (!savedData) {
        return;
    }

    const profileData = JSON.parse(savedData);
    document.getElementById('profile-name').value = profileData.name || '';
    document.getElementById('profile-email').value = profileData.email || '';
    document.getElementById('profile-phone').value = profileData.phone || '';

    if (document.getElementById('profile-car')) {
        document.getElementById('profile-car').value = profileData.car || '';
        document.getElementById('profile-plate').value = profileData.plate || '';
    }

    if (profileData.name) {
        document.getElementById('display-name').innerText = profileData.name;
        document.getElementById('avatar-initial').innerText = profileData.name.charAt(0).toUpperCase();
    }
}

// ==========================================
// --- 4. DRIVER DASHBOARD LOGIC ---
// ==========================================

window.lookForNewRides = function() {
    setInterval(async () => {
        const requestBox = document.getElementById('incoming-request');
        if (!requestBox || !isSupabaseConfigured()) return;

        const requests = await fetchDriverBookings(['pending']);
        if (requests.length > 0) {
            const rideData = requests[0];
            requestBox.dataset.bookingId = rideData.id;
            const routeTitle = document.getElementById('request-route');
            if (routeTitle) {
                routeTitle.innerText = `${rideData.origin} ➔ ${rideData.destination}`;
            }
            requestBox.style.display = 'block';
        } else {
            if (requestBox.style.background !== 'rgb(232, 245, 233)' && requestBox.style.background !== '#e8f5e9') {
                requestBox.style.display = 'none';
            }
        }
    }, 1000);
}

window.acceptRide = async function(bookingId) {
    try {
        await acceptTripRecord(bookingId);
        const requests = await fetchDriverBookings(['accepted']);
        const rideData = requests.find((booking) => String(booking.id) === String(bookingId));
        const requestBox = document.getElementById('incoming-request');
        if (requestBox && rideData) {
            requestBox.style.background = '#e8f5e9';
            requestBox.style.borderColor = '#c3e6cb';
            requestBox.innerHTML = `
                <h2 style="color: #155724;">Ride in Progress!</h2>
                <p style="font-size: 16px;">Navigating to drop-off: <strong>${rideData.destination}</strong></p>
                <button onclick="completeRide(${rideData.id})" style="padding: 12px 20px; background: #27ae60; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%; font-size: 16px;">✅ Complete Ride & Collect Payment</button>
            `;
        }
    } catch (error) {
        alert(error.message || 'Unable to accept this ride.');
    }
}

window.completeRide = async function(bookingId) {
    try {
        const requests = await fetchDriverBookings(['accepted']);
        const rideData = requests.find((booking) => String(booking.id) === String(bookingId));
        if (!rideData) {
            return;
        }

        await completeTripRecord(rideData);

        const requestBox = document.getElementById('incoming-request');
        if (requestBox) {
            requestBox.style.background = '#fff3cd';
            requestBox.style.borderColor = '#ffeeba';
            requestBox.innerHTML = `
                <h2 style="color: #856404; margin-top: 0;">Ride Finished!</h2>
                <p style="font-size: 16px;">Payment has been transferred to your wallet.</p>
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button onclick="document.getElementById('incoming-request').style.display='none'" style="flex: 1; padding: 10px; background: #fdfdfd; color: #333; border: 1px solid #ccc; border-radius: 6px; cursor: pointer; font-weight: bold;">Close</button>
                    <button onclick="window.location.href='driver-earn.html'" style="flex: 1; padding: 10px; background: #000; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">View Earnings</button>
                </div>
            `;
        }
    } catch (error) {
        alert(error.message || 'Unable to complete this ride.');
    }
}

// ==========================================
// --- 5. AUTOCOMPLETE LOGIC ---
// ==========================================

function setupAutocomplete(inputId) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    // Create dropdown container
    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    inputEl.parentNode.appendChild(dropdown);
    
    // Ensure parent has relative positioning
    if(window.getComputedStyle(inputEl.parentNode).position === 'static') {
        inputEl.parentNode.style.position = 'relative';
    }

    let timeout = null;

    inputEl.addEventListener('input', function() {
        const query = this.value;
        dropdown.innerHTML = '';
        dropdown.classList.remove('active');

        if (timeout) clearTimeout(timeout);

        if (query.length < 3) return;

        timeout = setTimeout(async () => {
            try {
                // Fetching from OpenStreetMap
                const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
                const data = await response.json();

                if (data && data.length > 0) {
                    dropdown.innerHTML = '';
                    data.forEach(item => {
                        const div = document.createElement('div');
                        div.className = 'autocomplete-item';
                        
                        // Extract a cleaner display name (city, region, country)
                        const displayNameParts = item.display_name.split(',');
                        const displayName = displayNameParts.slice(0,3).join(',').trim();

                        div.innerHTML = `
                            <svg class="autocomplete-item-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span class="autocomplete-item-text">${displayName}</span>
                        `;
                        
                        div.addEventListener('click', () => {
                            // On click, set input value to the first part (e.g. City name)
                            inputEl.value = displayNameParts[0].trim();
                            dropdown.classList.remove('active');
                        });

                        dropdown.appendChild(div);
                    });
                    dropdown.classList.add('active');
                }
            } catch (err) {
                console.error('Autocomplete error:', err);
            }
        }, 400); // 400ms debounce
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (e.target !== inputEl && !dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
}

// ==========================================
// --- 6. ACTIVE RIDE SIMULATOR ---
// ==========================================

async function startActiveRideMapAnimation(containerId, activeRide) {
    if (window.isAnimatingMap) return;
    window.isAnimatingMap = true;

    let container = document.getElementById(containerId);
    if (!container) {
        window.isAnimatingMap = false;
        return;
    }

    try {
        // Prevent Leaflet "already initialized" error
        if (container._leaflet_id) {
            container.outerHTML = `<div id="${containerId}"></div>`;
            container = document.getElementById(containerId);
            
            // Re-apply original styles since outerHTML replacement loses inline styles if they were set, but it uses CSS class so it's fine.
            if(!container.classList.contains('active-map-container')) {
                container.style.width = '100%';
                container.style.height = '350px';
                container.style.borderRadius = '12px';
            }
        }

        let startLatLng, endLatLng;
        try {
            const originRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(activeRide.origin)}`);
            const originData = await originRes.json();
            
            const destRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(activeRide.destination)}`);
            const destData = await destRes.json();

            if (originData.length === 0 || destData.length === 0) throw new Error("No map data");
            
            startLatLng = L.latLng(originData[0].lat, originData[0].lon);
            endLatLng = L.latLng(destData[0].lat, destData[0].lon);
        } catch (geocodeError) {
            // Fallback to random route if API fails or user enters weird addresses
            startLatLng = L.latLng(21.1702, 72.8311); // Surat
            endLatLng = L.latLng(23.2507, 72.5350);   // Gandhinagar
        }

        const map = L.map(containerId).setView(startLatLng, 10);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '©OpenStreetMap, ©CartoDB'
        }).addTo(map);

        // Custom Car Icon
        const carIcon = L.divIcon({
            html: `<div style="font-size: 28px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3)); transform: scaleX(-1);">🚗</div>`,
            className: '',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const routingControl = L.Routing.control({
            waypoints: [startLatLng, endLatLng],
            lineOptions: { styles: [{ color: '#3498db', weight: 5, opacity: 0.8 }] },
            createMarker: function(i, wp, nWps) {
                if(i === 0) return L.marker(wp.latLng, {icon: carIcon, zIndexOffset: 1000}); // Start marker is the car
                if(i === nWps - 1) return L.marker(wp.latLng); // End marker
                return null;
            },
            show: false,
            addWaypoints: false,
            routeWhileDragging: false,
            fitSelectedRoutes: true
        }).addTo(map);

        routingControl.on('routesfound', function(e) {
            const route = e.routes[0];
            const coordinates = route.coordinates;
            
            // Wait a moment before starting animation
            setTimeout(() => {
                let i = 0;
                // Animate over 15 seconds for realistic tracking
                const totalTime = 15000; 
                const intervalTime = totalTime / coordinates.length;
                
                // Find the car marker layer
                let carMarker = null;
                map.eachLayer((layer) => {
                    if(layer.options && layer.options.icon === carIcon) {
                        carMarker = layer;
                    }
                });
                
                if (!carMarker) {
                    window.isAnimatingMap = false;
                    return;
                }

                const animInterval = setInterval(() => {
                    if (i >= coordinates.length) {
                        clearInterval(animInterval);
                        window.isAnimatingMap = false;
                        completeActiveRide(activeRide);
                        return;
                    }
                    
                    const coord = coordinates[i];
                    carMarker.setLatLng([coord.lat, coord.lng]);
                    map.panTo([coord.lat, coord.lng], {animate: true, duration: intervalTime / 1000});
                    i++;
                }, intervalTime);
                
            }, 1500);
        });

    } catch (error) {
        console.error("Map Animation Error:", error);
        container.innerHTML = `<div style="padding: 20px; color: white;">Error loading active map.</div>`;
    }
}

async function completeActiveRide(activeRide) {
    try {
        // Mark trip as completed
        await updateTripRecord(activeRide.id, { status: 'completed' });
        
        // Redirect to receive payment page
        window.location.href = `driver-receive-payment.html?bookingId=${activeRide.id}`;
    } catch(e) {
        console.error("Failed to complete ride", e);
    }
}

// ==========================================
// --- AVATAR UPLOAD LOGIC ---
// ==========================================
async function compressAndUploadAvatar(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function (event) {
            const img = new Image();
            img.src = event.target.result;
            img.onload = async function () {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 256;
                const MAX_HEIGHT = 256;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Compress as JPEG
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

                try {
                    const session = await requireUserSession();
                    const { error } = await supabaseClient
                        .from('profiles')
                        .update({ avatar_url: dataUrl })
                        .eq('id', session.id);

                    if (error) throw error;

                    // Update local session
                    const currentProfile = getCachedProfile();
                    currentProfile.avatar_url = dataUrl;
                    localStorage.setItem(PROFILE_KEY, JSON.stringify(currentProfile));

                    const currentSession = getStoredSession();
                    currentSession.avatar_url = dataUrl;
                    localStorage.setItem(SESSION_KEY, JSON.stringify(currentSession));

                    resolve(dataUrl);
                } catch (err) {
                    reject(err);
                }
            };
        };
        reader.onerror = error => reject(error);
    });
}
