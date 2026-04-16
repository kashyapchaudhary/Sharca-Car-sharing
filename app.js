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
        .select('id, name, role, phone, car, plate')
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
        plate: profile.plate || ''
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
    const profile = getCachedProfile();
    const { error } = await supabaseClient
        .from('trip_bookings')
        .update({
            status: 'accepted',
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
    return fetchDriverBookings(['completed']);
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

        const { error: profileError } = await supabaseClient.from('profiles').upsert({
            id: signUpData.user.id,
            name,
            role: currentRole,
            phone: '',
            car: '',
            plate: ''
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
            plate: ''
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
    container.innerHTML = `<h3 style="color: #2c3e50; margin-bottom: 15px;">Available Rides (${distance} km)</h3>`;

    rides.forEach((ride) => {
        const rideCard = document.createElement('div');
        rideCard.style.border = '1px solid #dfe6e9';
        rideCard.style.borderRadius = '12px';
        rideCard.style.padding = '15px';
        rideCard.style.marginBottom = '15px';
        rideCard.style.background = '#fff';
        rideCard.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';

        const rideDataString = encodeURIComponent(JSON.stringify({ ...ride, origin, destination }));

        rideCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
                <div>
                    <h4 style="margin: 0 0 5px 0; font-size: 18px;">${ride.driver} <span style="color: #f39c12; font-size: 14px;">⭐ ${ride.rating}</span></h4>
                    <p style="margin: 0; color: #7f8c8d; font-size: 14px;">🚗 ${ride.car}</p>
                    <p style="margin: 5px 0 0 0; font-weight: bold; color: #34495e;">🕒 Departure: ${ride.time}</p>
                </div>
                
                <div style="text-align: right;">
                    <h2 style="margin: 0; color: #2e7d32;">₹${ride.price}</h2>
                    <p style="margin: 5px 0 10px 0; color: ${ride.seatsLeft === 1 ? '#e74c3c' : '#2980b9'}; font-weight: bold;">
                        💺 ${ride.seatsLeft} seat${ride.seatsLeft > 1 ? 's' : ''} left
                    </p>
                    <button onclick="confirmCarpoolBooking('${rideDataString}')" style="padding: 10px 20px; background: #000; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; width: 100%;">Book Seat</button>
                </div>
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
            <h3 style="color: #f39c12; margin-top: 0;">Requesting Seat...</h3>
            <p>Sending your request to <strong>${ride.driver}</strong> for the ${ride.time} ride.</p>
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
                    <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center; border: 2px solid #2e7d32;">
                        <h2 style="color: #2e7d32; margin-top: 0;">✅ Ride Confirmed!</h2>
                        <p style="font-size: 18px; margin-bottom: 5px;">Your driver, <strong>${rideData.driver_name}</strong>, is arriving soon.</p>
                        <p style="color: #555; margin-top: 0;">Vehicle: <strong>${rideData.car_details}</strong></p>
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
            document.getElementById('request-route').innerText = `${rideData.origin} ➔ ${rideData.destination}`;
            requestBox.style.display = 'block';
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