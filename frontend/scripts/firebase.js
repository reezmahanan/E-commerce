// firebase app state
let firebaseInitialized =
    false;

// validate firebase sdk
if (
    typeof firebase ===
    "undefined"
) {

    console.error(
        "Firebase SDK not loaded"
    );

} else if (

    !window.APP_CONFIG
    ||
    !window.APP_CONFIG.firebase

) {

    console.error(
        "Firebase config missing"
    );

} else {

    try {

        // firebase config
        const firebaseConfig =
            window.APP_CONFIG.firebase;

        // prevent duplicate initialization
        if (
            !firebase.apps.length
        ) {

            firebase.initializeApp(
                firebaseConfig
            );

            console.log(
                "Firebase initialized successfully"
            );
        }

        firebaseInitialized =
            true;

        // auth instance
        const firebaseAuth =
            firebase.auth();

        // auth provider
        const googleProvider =
            new firebase.auth.GoogleAuthProvider();

        // provider settings
        googleProvider.setCustomParameters({

            prompt:
                "select_account"
        });

        // persistence
        firebaseAuth.setPersistence(
            firebase.auth.Auth.Persistence.LOCAL
        )

            .then(
                () => {

                    console.log(
                        "Firebase persistence enabled"
                    );
                }
            )

            .catch(
                (
                    error
                ) => {

                    console.error(
                        "Firebase persistence error:",
                        error
                    );
                }
            );

        // auth state listener
        firebaseAuth.onAuthStateChanged(
            (
                user
            ) => {

                if (
                    user
                ) {

                    console.log(
                        "Firebase user authenticated:",
                        user.email
                    );

                } else {

                    console.log(
                        "Firebase user signed out"
                    );
                }
            }
        );

        // expose globally
        window.firebaseInitialized =
            firebaseInitialized;

        window.firebaseAuth =
            firebaseAuth;

        window.googleProvider =
            googleProvider;

        // helper
        window.isFirebaseReady =
            () => {

                return (
                    firebaseInitialized
                    &&
                    !!window.firebaseAuth
                );
            };

    } catch (error) {

        console.error(
            "Firebase initialization failed:",
            error
        );

        window.firebaseInitialized =
            false;
    }
}