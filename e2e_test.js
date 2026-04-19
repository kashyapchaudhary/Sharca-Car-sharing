const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('LOG:', msg.text()));
    page.on('pageerror', err => console.log('ERROR:', err.toString()));
    
    console.log("Navigating to index...");
    await page.goto('http://localhost:8001/index.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // 1. Driver Sign Up
    console.log("Signing up driver...");
    await page.click('#btn-driver');
    await page.type('#auth-name', 'Driver Dan');
    await page.type('#auth-email', 'driver@test.com');
    await page.type('#auth-password', '123456');
    await page.click('#auth-form button[type="submit"]');
    
    // Wait for redirect to driver-profile
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log("On page:", page.url());

    // Submit profile
    if (page.url().includes('driver-profile')) {
        await page.type('#car-model', 'Honda Civic');
        await page.type('#license-plate', 'ABC-123');
        await page.click('.profile-form button[type="submit"]');
        await page.waitForNavigation({ waitUntil: 'networkidle0' });
        console.log("Profile submitted, now on:", page.url());
    }

    // Go to driver-add-ride and publish
    console.log("Publishing ride...");
    await page.goto('http://localhost:8001/driver-add-ride.html');
    await page.type('#ride-origin', 'New York');
    await page.type('#ride-destination', 'Boston');
    await page.type('#ride-date', '2027-01-01');
    await page.type('#ride-time', '10:00');
    await page.type('#ride-price', '50');
    await page.type('#ride-seats', '3');
    await page.click('.ride-form button[type="submit"]');
    await new Promise(r => setTimeout(r, 1000));

    // Log out
    console.log("Logging out driver...");
    await page.evaluate(() => {
        if(typeof window.logout === 'function') window.logout();
        else localStorage.removeItem('sharcaSession');
    });
    await page.goto('http://localhost:8001/index.html');

    // 2. User Sign Up
    console.log("Signing up user...");
    await page.click('#btn-user');
    await page.type('#auth-name', 'User Uma');
    await page.type('#auth-email', 'user@test.com');
    await page.type('#auth-password', '123456');
    await page.click('#auth-form button[type="submit"]');
    
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log("On page:", page.url());

    // Search and book ride
    console.log("Booking ride...");
    await page.type('#search-origin', 'New York');
    await page.type('#search-destination', 'Boston');
    await page.click('.search-box button');
    await new Promise(r => setTimeout(r, 1000));
    
    // Click book
    await page.evaluate(() => {
        const btns = document.querySelectorAll('.btn-book');
        if(btns.length > 0) btns[0].click();
    });
    await new Promise(r => setTimeout(r, 1000));
    // Check local storage
    const bookings = await page.evaluate(() => localStorage.getItem('mock_trip_bookings'));
    console.log("Bookings after request:", bookings);

    // Log out
    console.log("Logging out user...");
    await page.evaluate(() => {
        if(typeof window.logout === 'function') window.logout();
        else localStorage.removeItem('sharcaSession');
    });
    await page.goto('http://localhost:8001/index.html');

    // 3. Driver logs in
    console.log("Logging in driver...");
    await page.click('#btn-driver');
    await page.evaluate(() => isSignup = false);
    await page.type('#auth-email', 'driver@test.com');
    await page.type('#auth-password', '123456');
    await page.click('#auth-form button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    console.log("On page:", page.url());

    // Look for accept button
    console.log("Checking dashboard...");
    await new Promise(r => setTimeout(r, 2000));
    
    const clickResult = await page.evaluate(() => {
        let liveBtn = document.querySelector('.btn-accept-live');
        let staticBtn = document.querySelector('.btn-req-accept');
        if (liveBtn) { liveBtn.click(); return 'live clicked'; }
        if (staticBtn) { staticBtn.click(); return 'static clicked'; }
        return 'no button found';
    });
    console.log("Accept button click:", clickResult);
    
    await new Promise(r => setTimeout(r, 2000));
    
    const activeSection = await page.evaluate(() => document.getElementById('active-ride-section').style.display);
    console.log("Active section display:", activeSection);

    const updatedBookings = await page.evaluate(() => localStorage.getItem('mock_trip_bookings'));
    console.log("Bookings after accept:", updatedBookings);

    await browser.close();
})();
