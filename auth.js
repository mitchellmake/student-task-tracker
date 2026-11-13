
const supabaseClient = window.supabase.createClient(
    window.CAMPUSKIT_SUPABASE.url,
    window.CAMPUSKIT_SUPABASE.key
);

const authPanel = document.getElementById("authPanel");
const appContent = document.getElementById("appContent");
const authMessage = document.getElementById("authMessage");
const accountLabel = document.getElementById("accountLabel");
const logoutButton = document.getElementById("logoutButton");

function showMessage(message, isError = false) {
    authMessage.textContent = message;
    authMessage.style.color = isError ? "#b45b50" : "#52836d";
}

function showSignedOut() {
    authPanel.hidden = false;
    appContent.hidden = true;
    accountLabel.textContent = "";
    logoutButton.hidden = true;
}

function showSignedIn(user) {
    authPanel.hidden = true;
    appContent.hidden = false;
    accountLabel.textContent =
        user.user_metadata?.full_name || user.email || "Student";
    logoutButton.hidden = false;
}

document.getElementById("registerForm").addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

    showMessage("Creating your account...");

    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
            data: { full_name: name }
        }
    });

    if (error) {
        showMessage(error.message, true);
        return;
    }

    if (data.session) {
        showMessage("Account created successfully.");
    } else {
        showMessage("Account created. Please check your email to confirm your account, then sign in.");
    }
});

document.getElementById("loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    showMessage("Signing in...");

    const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        showMessage(error.message, true);
    }
});

logoutButton.addEventListener("click", async () => {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        showMessage(error.message, true);
    }
});

supabaseClient.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
        showSignedIn(session.user);
    } else {
        showSignedOut();
    }
});

(async function checkExistingSession() {
    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        showMessage("Unable to check your session. Please refresh.", true);
        return;
    }

    if (data.session?.user) {
        showSignedIn(data.session.user);
    } else {
        showSignedOut();
    }
})();


const googleSignInButton = document.getElementById("googleSignInButton");

googleSignInButton?.addEventListener("click", async () => {
    showMessage("Connecting to Google...");
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: "https://mitchellmake.github.io/student-task-tracker/"
        }
    });

    if (error) {
        showMessage(error.message, true);
    }
});

window.campuskitSupabase = supabaseClient;
