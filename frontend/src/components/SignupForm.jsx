import { useState } from "react";
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from "firebase/auth";
import { createUserProfile } from "../services/firestoreService";


import './LoginForm.css'

function SignupForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user; // ✅ define first
console.log('✅ Created Firebase Auth user:', user.uid, user.email);

            console.log('Created account with email: ', userCredential.user);

            // 👇 Create a corresponding Firestore user profile
            await createUserProfile(user.uid, {
            email: user.email,
            name: "", // You can collect this in your form later
      });

      console.log("✅ Firestore user document created");


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