console.log("Authentication system loaded successfully!");

// =============================
// FIREBASE CONFIG
// =============================

const firebaseConfig = {

    apiKey: "YOUR_API_KEY",

    authDomain: "YOUR_AUTH_DOMAIN",

    projectId: "YOUR_PROJECT_ID",

    appId: "YOUR_APP_ID"

};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

// =============================
// AUTH PROVIDERS
// =============================

const googleProvider =
    new firebase.auth.GoogleAuthProvider();

const githubProvider =
    new firebase.auth.GithubAuthProvider();

const appleProvider =
    new firebase.auth.OAuthProvider("apple.com");

// =============================
// GOOGLE LOGIN
// =============================

const googleBtn =
    document.getElementById("google-login");

if(googleBtn){

    googleBtn.addEventListener(
        "click",
        async () => {

            try{

                await auth.signInWithPopup(
                    googleProvider
                );

                alert(
                    "Google Login Successful!"
                );

                window.location.href =
                    "index.html";

            }catch(error){

                console.error(error);

                alert(error.message);

            }

        }
    );

}

// =============================
// GITHUB LOGIN
// =============================

const githubBtn =
    document.getElementById("github-login");

if(githubBtn){

    githubBtn.addEventListener(
        "click",
        async () => {

            try{

                await auth.signInWithPopup(
                    githubProvider
                );

                alert(
                    "GitHub Login Successful!"
                );

                window.location.href =
                    "index.html";

            }catch(error){

                console.error(error);

                alert(error.message);

            }

        }
    );

}

// =============================
// APPLE LOGIN
// =============================

const appleBtn =
    document.getElementById("apple-login");

if(appleBtn){

    appleBtn.addEventListener(
        "click",
        async () => {

            try{

                await auth.signInWithPopup(
                    appleProvider
                );

                alert(
                    "Apple Login Successful!"
                );

                window.location.href =
                    "index.html";

            }catch(error){

                console.error(error);

                alert(error.message);

            }

        }
    );

}

// =============================
// EMAIL SIGNUP
// =============================

const signupForm =
    document.getElementById("signup-form");

if(signupForm){

    signupForm.addEventListener(
        "submit",
        async (e) => {

            e.preventDefault();

            const name =
                document.getElementById(
                    "signup-name"
                ).value;

            const email =
                document.getElementById(
                    "signup-email"
                ).value;

            const password =
                document.getElementById(
                    "signup-password"
                ).value;

            try{

                const userCredential =
                    await auth
                    .createUserWithEmailAndPassword(
                        email,
                        password
                    );

                await userCredential.user
                    .updateProfile({

                        displayName: name

                    });

                alert(
                    "Account Created Successfully!"
                );

                window.location.href =
                    "signin.html";

            }catch(error){

                console.error(error);

                alert(error.message);

            }

        }
    );

}

// =============================
// EMAIL SIGNIN
// =============================

const signinForm =
    document.getElementById("signin-form");

if(signinForm){

    signinForm.addEventListener(
        "submit",
        async (e) => {

            e.preventDefault();

            const email =
                document.getElementById(
                    "signin-email"
                ).value;

            const password =
                document.getElementById(
                    "signin-password"
                ).value;

            try{

                await auth
                    .signInWithEmailAndPassword(
                        email,
                        password
                    );

                alert("Login Successful!");

                window.location.href =
                    "index.html";

            }catch(error){

                console.error(error);

                alert(error.message);

            }

        }
    );

}

// =============================
// AUTH NAVBAR PROFILE SYSTEM
// =============================

auth.onAuthStateChanged((user) => {

    const authLink =
        document.getElementById(
            "auth-link"
        );

    const dropdown =
        document.getElementById(
            "profile-dropdown"
        );

    const logoutBtn =
        document.getElementById(
            "logout-btn"
        );

    if(!authLink) return;

    // =============================
    // USER LOGGED IN
    // =============================

    if(user){

        authLink.innerHTML = `
            <i class="fas fa-user"></i>
        `;

        authLink.href = "#";

        authLink.classList.add(
            "profile-active"
        );

        authLink.title =
            user.email || "User";

        // Toggle Dropdown

        authLink.addEventListener(
            "click",
            (e) => {

                e.preventDefault();

                if(dropdown){

                    dropdown.classList.toggle(
                        "active"
                    );

                }

            }
        );

        // Logout

        if(logoutBtn){

            logoutBtn.addEventListener(
                "click",
                async () => {

                    try{

                        await auth.signOut();

                        window.location.href =
                            "index.html";

                    }catch(error){

                        console.error(error);

                    }

                }
            );

        }

        // Close Dropdown Outside Click

        document.addEventListener(
            "click",
            (e) => {

                if(
                    !e.target.closest(
                        ".profile-wrapper"
                    )
                ){

                    if(dropdown){

                        dropdown.classList.remove(
                            "active"
                        );

                    }

                }

            }
        );

    }

    // =============================
    // USER LOGGED OUT
    // =============================

    else{

        authLink.innerHTML = "Sign In";

        authLink.href = "signin.html";

        authLink.classList.remove(
            "profile-active"
        );

        if(dropdown){

            dropdown.classList.remove(
                "active"
            );

        }

    }

});