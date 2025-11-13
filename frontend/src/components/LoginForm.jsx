import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
            console.log('Logged in:', userCredential.user);
        } catch (error) {
            console.error(error.message);
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
                <button type="submit" className="signup-button-inline">Login</button>
            </div>
        </form>
    )
}

export default LoginForm;