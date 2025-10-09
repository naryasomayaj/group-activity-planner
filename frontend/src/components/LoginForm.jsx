import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from '../firebase';

import './LoginForm.css'

function LoginForm() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const idToken= await user.getIdToken();
            console.log("ID Token:", idToken);
            //console.log('Logged in:', userCredential.user);
            const response = await fetch("http://localhost:8000/api/protected", {
            method: "GET",   // or POST if needed
            headers: {
                "Authorization": `Bearer ${idToken}`, // send JWT
                "Content-Type": "application/json"
            }
         });

    const data = await response.json();
    console.log("Backend response:", data);
        } catch (error) {
            console.error("Login error",error.message);
        }
    };

    return (
        <form onSubmit={handleLogin} className="login-form">
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
                <button type="submit">Login</button>
            </div>
        </form>
    )
}

export default LoginForm;