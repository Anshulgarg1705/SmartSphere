
document.addEventListener("DOMContentLoaded", function () {

    const SUPABASE_URL = "https://tmplfykqfhvwgfoavjlx.supabase.co";

    const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_3GfaeEPt1nf-nWOGW1XCVw_8GOEe_0D";

    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

    const loginForm = document.getElementById("loginForm");
    const roleInput = document.getElementById("role");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const rememberInput = document.getElementById("remember");
    const errorMessage = document.getElementById("errorMessage");
    const loginBtn = document.getElementById("loginBtn");

    const savedEmail = localStorage.getItem("smartsphereRememberedEmail");

    if (savedEmail) {
        emailInput.value = savedEmail;
        rememberInput.checked = true;
    }

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        errorMessage.textContent = "";

        const selectedRole = roleInput.value;
        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        if (!email || !password) {
            showError("Please enter your email and password.");
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = "Signing In...";

        try {

            const { data: authData, error: authError } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });

            if (authError) {
                throw new Error("Invalid email or password.");
            }

            const { data: profile, error: profileError } =
                await supabaseClient
                    .from("profiles")
                    .select("id, name, email, role, department, class_id, status")
                    .eq("id", authData.user.id)
                    .single();

            if (profileError || !profile) {

                await supabaseClient.auth.signOut();

                throw new Error(
                    "Your profile was not found. Contact the administrator."
                );
            }

            // ACCOUNT STATUS VALIDATION

            const accountStatus = String(
                profile.status || "active"
            ).toLowerCase();

            if (accountStatus !== "active") {

                await supabaseClient.auth.signOut();

                localStorage.removeItem("smartsphereUser");

                throw new Error(
                    "Your account has been deactivated. Please contact the administrator."
                );
            }

            // ROLE VALIDATION

            if (profile.role !== selectedRole) {

                await supabaseClient.auth.signOut();

                throw new Error(
                    "You selected the wrong login role. Please select your correct role."
                );
            }

            // REMEMBER EMAIL

            if (rememberInput.checked) {

                localStorage.setItem(
                    "smartsphereRememberedEmail",
                    email
                );

            } else {

                localStorage.removeItem("smartsphereRememberedEmail");

            }

            // STORE USER SESSION INFORMATION

            const loggedInUser = {
                id: profile.id,
                name: profile.name,
                email: profile.email,
                role: profile.role,
                department: profile.department || "",
                class_id: profile.class_id || null,
                status: accountStatus,
                lastLogin: new Date().toISOString()
            };

            localStorage.setItem(
                "smartsphereUser",
                JSON.stringify(loggedInUser)
            );

            // ROLE-BASED REDIRECTION

            if (profile.role === "admin") {

                window.location.href = "admin.html";

            } else if (profile.role === "teacher") {

                window.location.href = "teacher.html";

            } else if (profile.role === "student") {

                window.location.href = "student.html";

            } else {

                await supabaseClient.auth.signOut();

                localStorage.removeItem("smartsphereUser");

                throw new Error("Invalid account role.");

            }

        } catch (error) {

            console.error("Login error:", error);

            showError(
                error.message || "Something went wrong. Please try again."
            );

        } finally {

            loginBtn.disabled = false;
            loginBtn.textContent = "Sign In →";

        }

    });

    function showError(message) {
        errorMessage.textContent = message;
    }

});
