import { useState } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../firebase';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';

function NavBar() {
    const [isLoggedIn, setLoggedIn] = useState(false);
    const auth = getAuth();

    const handleLogout = async (e) => {
        try {
            await signOut(auth);
            console.log("User signed out!");
        } catch (e) {
            console.error("Error signing out:", e);
        }
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            setLoggedIn(true);
            console.log("User is logged in!");
        } else {
            setLoggedIn(false);
            console.log("User is logged out!");
        }
    });

    return(
        <>
            <nav>
                <Link to="/">Home</Link> |
                <Link to="/about">About</Link> | 
                {isLoggedIn &&
                <Link to="/profile">Profile</Link>
                }
                {isLoggedIn ? 
                <button onClick={handleLogout}>Log Out</button>
                :
                <Link to="/login">Sign In</Link>
                }
            </nav>
        </>
    )
}

export default NavBar;