import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

function Profile() {
    const [isEdit, setEdit] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [activities, setActivities] = useState("");

    const auth = getAuth();

    onAuthStateChanged(auth, (user) => {
        if(user) {
            setEmail(user.email);
        }
    });
    
    const getToken = async (e) => {
        const user = auth.currentUser;
        if(!user) throw new Error("No user is logged in?");

        const token = await user.getIdToken();
        return token;
    }

    const getUID = async (e) => {
        const user = auth.currentUser;
        if(!user) throw new Error("No user is logged in?");

        const uid = await user.getUID();
        return uid;
    }

    const fetchData = async (e) => {
        try {
            const response = await fetch(`http://localhost:5000/api/users/${getUID}`, {
                method: "GET",
                headers: {
                    "Authorization" : `accessToken ${getToken()}`
                },
            });

            if(!response.ok)
                throw new Error(`Server error: ${response.status}`);

            const result = await response.json();
            console.log("Successfully fetched data: ", result);
        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    const submitData = async (e) => {
        try {
            const response = await fetch(`http://localhost:5000/api/users/${getUID}`, {
                method: "PUT",
                headers: {
                    "Content-Type" : "application/json",
                    "Authorization" : `accessToken ${getToken()}`,
                },
                body: JSON.stringify({
                    name: name.name,
                    activities: activities.name
                }),
            });
        } catch (error) {
            console.error("Error submitting data:", error);
        }
    }

    useEffect(() => {
        fetchData();
    }, []);

    const handleEdit = (e) => {
        setEdit(true);
    }

    const handleSubmit = async (e) => {
        setEdit(false);
        submitData();
        fetchData();
    }

    const handleCancel = (e) => {
        setEdit(false);
        fetchData();
    }

    return(
        <>
            <h2>Profile</h2>
            {isEdit ?
            <>
            <h3>Name: </h3>
            <input type="text" name="name" value={name} onChange={(e) => setName(e.target.value)} />
            <h3>Email: </h3>
            <input type="text" name="email" value={email} readonly />
            <h3>Activities: </h3>
            <textarea name="activities" rows="5" cols="40" placeholder="Enter your comma separated activities here" value={activities} onChange={(e) => setActivities(e.target.value)} />
            <br></br><br></br>
            <button onClick={handleSubmit}>Submit</button>
            <button onClick={handleCancel}>Cancel</button>
            </>
            :
            <>
            <button onClick={handleEdit}>Edit</button>
            <h3>Name: </h3>
            <p>{name}</p>
            <h3>Email: </h3>
            <p>{email}</p>
            <h3>Activities: </h3>
            <p></p>
            </>     
            }
        </>
    )
}

export default Profile