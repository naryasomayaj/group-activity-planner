import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

function Home() {
    const auth = getAuth();
    const [isLoading, setLoading] = useState(true);
    const [isLoggedIn, setLoggedIn] = useState(false);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(u => setLoading(false));
        return unsubscribe;
    }, []);

    onAuthStateChanged(auth, (user) => {
        if(user) {
            setLoggedIn(true);
        } else {
            setLoggedIn(false);
        }
    });

    return(
        isLoading ?
        <>
            <h2>Home</h2>
        </>
        :
        isLoggedIn ?
        <>
            <h2>Home</h2>
            <button>Create Group</button>
            <br></br>
            <br></br>
            <button>Join Group</button>
        </>
        :
        <>
            <h2>Home</h2>
            <p>This website helps you pick a group activity via an AI-powered algorithm that factors in your and your invitees interests! Sign up or login to get started!</p>
        </>
    )
}

export default Home;