import { useState } from "react";
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from "firebase/auth";

import './LoginForm.css'

function SignupForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('Created account with email: ', userCredential.user);

            const user = userCredential.user;

        // Get Firebase ID token (JWT)
        const idToken = await user.getIdToken();

        // Call backend to register user in your DB
        const response = await fetch("http://localhost:8000/api/register", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${idToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            email: user.email,   // optional extra fields
        })
        });
        const data = await response.json();
        console.log("Backend registration:", data);
        } catch (error) {
            console.error(error.message);
        }
    };

    return (
        <form onSubmit={handleSignup} className="login-form">
            <div className="login-form-line">
                <label>Email: </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
            </div>
            <div className="login-form-line">
                <label>Password: </label>
                <input
                  type = "password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            <div className="login-form-line">
                <button type="submit">Create Account</button>
            </div>
        </form>
    )
}

export default SignupForm;