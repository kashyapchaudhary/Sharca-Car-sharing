import re

with open("app.js", "r") as f:
    content = f.read()

# Update fetchProfileByUserId
content = content.replace(
    ".select('id, name, role, phone, car, plate')",
    ".select('id, name, role, phone, car, plate, avatar_url')"
)

# Update saveSession
pattern_save = re.compile(
    r"function saveSession\(account, rememberSession\) \{\n    const sessionData = \{\n        id: account\.id \|\| null,\n        name: account\.name,\n        email: account\.email,\n        role: account\.role,\n        phone: account\.phone \|\| '',\n        car: account\.car \|\| '',\n        plate: account\.plate \|\| '',\n        isLoggedIn: true,\n        loginAt: new Date\(\)\.toISOString\(\),\n        persistent: Boolean\(rememberSession\)\n    \};",
    re.MULTILINE
)
replacement_save = r"""function saveSession(account, rememberSession) {
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
    };"""
content = pattern_save.sub(replacement_save, content)

# Update hydrateSessionFromSupabase
pattern_hydrate = re.compile(
    r"saveSession\(\{\n        id: session\.user\.id,\n        name: profile\.name \|\| session\.user\.email \|\| 'Sharca User',\n        email: session\.user\.email \|\| '',\n        role: profile\.role,\n        phone: profile\.phone \|\| '',\n        car: profile\.car \|\| '',\n        plate: profile\.plate \|\| ''\n    \}, true\);"
)
replacement_hydrate = r"""saveSession({
        id: session.user.id,
        name: profile.name || session.user.email || 'Sharca User',
        email: session.user.email || '',
        role: profile.role,
        phone: profile.phone || '',
        car: profile.car || '',
        plate: profile.plate || '',
        avatar_url: profile.avatar_url || ''
    }, true);"""
content = pattern_hydrate.sub(replacement_hydrate, content)

# Update upsert in handleAuth
pattern_auth = re.compile(
    r"const \{ error: profileError \} = await supabaseClient\.from\('profiles'\)\.upsert\(\{\n            id: signUpData\.user\.id,\n            name,\n            role: currentRole,\n            phone: '',\n            car: '',\n            plate: ''\n        \}\);"
)
replacement_auth = r"""const { error: profileError } = await supabaseClient.from('profiles').upsert({
            id: signUpData.user.id,
            name,
            role: currentRole,
            phone: '',
            car: '',
            plate: '',
            avatar_url: ''
        });"""
content = pattern_auth.sub(replacement_auth, content)

pattern_auth2 = re.compile(
    r"saveSession\(\{\n            id: signUpData\.user\.id,\n            name,\n            email,\n            role: currentRole,\n            phone: '',\n            car: '',\n            plate: ''\n        \}, rememberSession\);"
)
replacement_auth2 = r"""saveSession({
            id: signUpData.user.id,
            name,
            email,
            role: currentRole,
            phone: '',
            car: '',
            plate: '',
            avatar_url: ''
        }, rememberSession);"""
content = pattern_auth2.sub(replacement_auth2, content)

# Append compressAndUploadAvatar
append_func = """

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
"""

if "compressAndUploadAvatar" not in content:
    content += append_func

with open("app.js", "w") as f:
    f.write(content)

print("app.js patched")
