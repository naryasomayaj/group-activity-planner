/**
 * This is a quick simple version of the Group Activity Planner web app for CS 520
 * Written by: Ben Wei
 * 
 * Certain functions have comments for backend implementation
 */

import { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import LoginForm from '../components/LoginForm';
import SignupForm from '../components/SignUpForm';

function SinglePage() {
    const auth = getAuth();
    const [isLoading, setLoading] = useState(true);
    const [isLoggedIn, setLoggedIn] = useState(false);
    const [loginStep, setLoginStep] = useState(0);
    const [activeTab, setActiveTab] = useState("tab1");
    const [isProfileEdit, setProfileEdit] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [activities, setActivities] = useState("");
    const [groupJoinID, setGroupJoinID] = useState("");
    const [groupInfo, setGroupInfo] = useState([]);

    let loginElement;

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            setLoading(false)
            
            if(user) {
                fetchData();
                fetchGroups();
                setLoggedIn(true);
            } else {
                setLoggedIn(false);
            }
        });
        return unsubscribe;
    }, []);

    const handleLogout = async (e) => {
        try {
            await signOut(auth);
            console.log("User signed out!");
        } catch (e) {
            console.error("Error signing out:", e);
        }
    }

    switch (loginStep) {
        case 1:
            loginElement = <>
            <button onClick={() => setLoginStep(0)}>Back</button>
            <p>Enter an email and password to get started:</p>
            <SignupForm />
            </>
            break;
        default:
            loginElement = <>
            <LoginForm />
            <p>Don't have an account?</p>
            <button onClick={() => setLoginStep(1)}>Click here to sign up</button>
            </>
    }

    const submitData = () => {
        /* This function must submit the user's data to the database */
    }

    const fetchData = async () => {
        /* This function must fetch the user's data from the database */
    }

    const fetchGroups = () => {
        /* This function must fetch the user's groups from the database and set the group info accordingly */

        setGroupInfo([
            {
                name: "Group 1",
                members: ["Example member1", "Example member2"],
                events: [{name: "Getting food somewhere",
                          id: 1,
                          location: "Amherst",
                          budget: "$0",
                          vibe: "outdoors",},
                         {name: "After class study break",
                          id: 2,
                          location: "Amherst",
                          budget: "$30",
                          vibe: "outdoors",},
                ],
                admin: "Example member1",
                id: 1,
            },
            {
                name: "Group 2",
                members: ["Example member1"],
                events: [{name: "Event 3",
                          id: 3,
                          location: "Amherst",
                          budget: "$40",
                          vibe: "outdoors",},],
                admin: "Example member1",
                id: 2,
            },
        ]);

       console.log("Fetch groups!");
    }

    const createGroup = () => {
        /* This function must create a group with a new group ID and place the user in that group */

        setGroupInfo(previous => [...previous,
            {
                name: "New Group",
                members: ["Example member1",],
                events: [{name: "Event 1"},],
                admin: "Example member1",
                id: 3,
            }
        ]);
    }

    const joinGroup = async () => {
        /* This function must join a group specified in groupID */
    }

    const leaveGroup = (id) => {
        /* This function should leave a group specified in groupID */
    }

    const addEvent = (id) => {
        /* This function should add an event to the specified group */

    }

    const joinEvent = (id) => {
        /* This function should join an event specified by an event id */

    }

    const leaveEvent = (id) => {
        /* This function should leave an event specified by an event id */

    }

    const handleSubmit = async (e) => {
        setProfileEdit(false);
        submitData();
        fetchData();
    }

    const handleCancel = (e) => {
        setProfileEdit(false);
        fetchData();
    }

    return(
        <>
        <h1>Group Activity Planner</h1>
        {isLoggedIn ? (
        <div className="tabs">
            <div className="tab-headers">
                <button disabled={activeTab === "tab1"} onClick={() => setActiveTab("tab1")}>
                Groups
                </button>
                <button disabled={activeTab === "tab2"} onClick={() => setActiveTab("tab2")}>
                My Profile
                </button>
            </div>
            <div className="tab-content">
                {activeTab === "tab1" && <div>
                    <br></br>
                    <button onClick={createGroup}>Create Group</button>
                    <button onClick={joinGroup}>Join Group</button>
                    <input type="text" name="groupJoinID" value={groupJoinID} placeholder="Group ID Code" onChange={(e) => setGroupJoinID(e.target.value)}/>
                    <h3>My Groups:</h3>
                    {groupInfo.map(group => (
                        <details key={group.id}>
                            <summary>{group.name}</summary>
                            {group.events.map(event => (
                                <details key={event.id}>
                                    {true ?
                                        <>
                                            <summary>{event.name}</summary>
                                            <p>location: {event.location}</p>
                                            <p>budget: {event.budget}</p>
                                            <p>vibe: {event.vibe}</p>
                                            <button>Edit</button>
                                            <button onClick={() => joinEvent(group.id)}>Join</button>
                                        </>
                                    :
                                        <>
                                            <summary>{event.name}</summary>
                                            <p>location: {event.location}</p>
                                            <p>budget: {event.budget}</p>
                                            <p>vibe: {event.vibe}</p>
                                            <button>Edit</button>
                                            <button onClick={() => joinEvent(group.id)}>Join</button>
                                        </>
                                    }
                                </details>
                            ))}
                            <button onClick={() => addEvent(group.id)}>Add Event</button>
                            <button onClick={() => leaveGroup(group.id)}>Leave Group</button>
                        </details>
                    ))}
                </div>}
                {activeTab === "tab2" && <div>
                    {isProfileEdit ?
                        <>
                        <h3>Name: </h3>
                        <input type="text" name="name" value={name} onChange={(e) => setName(e.target.value)} />
                        <h3>Email: </h3>
                        <input type="text" name="email" value={email} readOnly />
                        <h3>Activities: </h3>
                        <textarea name="activities" rows="5" cols="40" placeholder="Enter your comma separated activities here" value={activities} onChange={(e) => setActivities(e.target.value)} />
                        <br></br><br></br>
                        <button onClick={handleSubmit}>Submit</button>
                        <button onClick={handleCancel}>Cancel</button>
                        </>
                    :
                        <>
                        <h3>Name: </h3>
                        <p>{name}</p>
                        <h3>Email: </h3>
                        <p>{email}</p>
                        <h3>Activities: </h3>
                        <p>{activities}</p>
                        <button onClick={() => setProfileEdit(true)}>Edit</button>
                        </>
                    }
                    <br></br><br></br>
                    <button onClick={handleLogout}>Sign Out</button>
                </div>}
            </div>
        </div>
        ) : (
        <div style={{ width: "90%", display: "table", tableLayout: "fixed"}}>
            <div style={{display: "table-row"}}>
                <div style={{display: "table-cell", padding: "3px"}}>
                    <p>Welcome to Group Activity Planner, a website that helps you and your group find and schedule new activities. Please login or sign up to get started.</p>
                </div>
                <div style={{display: "table-cell", padding: "3px"}}>
                    {loginElement}
                </div>
            </div>
        </div>
        )}
        </>
    )
}

export default SinglePage;