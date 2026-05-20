console.log("Authentication system loaded successfully!");

// =============================
// BACKEND AUTH FUNCTIONS
// =============================

const signupUser = async (name, email, password) => {
    const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
    });
    return await res.json();
};

const loginUser = async (email, password) => {
    const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });
    return await res.json();
};

// =============================
// EMAIL SIGNUP
// =============================

const signupForm = document.getElementById("signup-form");
if(signupForm){
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("signup-name").value;
        const email = document.getElementById("signup-email").value;
        const password = document.getElementById("signup-password").value;
        try {
            const response = await signupUser(name, email, password);
            if(response.success){
                alert("Account Created Successfully!");
                window.location.href = "signin.html";
            } else {
                alert(response.message);
            }
        } catch(error){
            console.error(error);
            alert("Signup failed. Please try again.");
        }
    });
}

// =============================
// EMAIL SIGNIN
// =============================

const signinForm = document.getElementById("signin-form");
if(signinForm){
    signinForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("signin-email").value;
        const password = document.getElementById("signin-password").value;
        try {
            const response = await loginUser(email, password);
            if(response.success){
                // Store JWT in localStorage
                localStorage.setItem("token", response.token);
                alert("Login Successful!");
                window.location.href = "index.html";
            } else {
                alert(response.message);
            }
        } catch(error){
            console.error(error);
            alert("Login failed. Please try again.");
        }
    });
}

// =============================
// AUTH NAVBAR PROFILE SYSTEM (JWT)
// =============================

const token = localStorage.getItem("token");
const authLink = document.getElementById("auth-link");
const dropdown = document.getElementById("profile-dropdown");
const logoutBtn = document.getElementById("logout-btn");

if(authLink){
    if(token){
        authLink.innerHTML = `<i class="fas fa-user"></i>`;
        authLink.href = "#";
        authLink.classList.add("profile-active");

        // Toggle Dropdown
        authLink.addEventListener("click", (e) => {
            e.preventDefault();
            if(dropdown) dropdown.classList.toggle("active");
        });

        // Logout
        if(logoutBtn){
            logoutBtn.addEventListener("click", () => {
                localStorage.removeItem("token");
                window.location.href = "index.html";
            });
        }

        // Close Dropdown on outside click
        document.addEventListener("click", (e) => {
            if(!e.target.closest(".profile-wrapper")){
                if(dropdown) dropdown.classList.remove("active");
            }
        });
    } else {
        authLink.innerHTML = "Sign In";
        authLink.href = "signin.html";
        authLink.classList.remove("profile-active");
        if(dropdown) dropdown.classList.remove("active");
    }
}