import { useState } from "react";
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

import './LoginForm.css'

function SignupForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            // Create the authentication account
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('Created account with email: ', userCredential.user);
            
            // Create a document in the Users collection
            const userDocRef = doc(db, 'Users', userCredential.user.uid);
            await setDoc(userDocRef, {
                email: email,
                createdAt: new Date().toISOString(),
                activities: [],
                // Add any other initial user data fields you want
            });
            console.log('Created user document in Firestore');
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