/**
 * This is a quick simple version of the Group Activity Planner web app for CS 520
 * Written by: Ben Wei
 * 
 * Certain functions have comments for backend implementation
 */

import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, addDoc, arrayUnion, arrayRemove, setDoc, runTransaction} from 'firebase/firestore';
import LoginForm from '../components/LoginForm';
import SignupForm from '../components/SignUpForm';

function SinglePage() {
    const auth = getAuth();
    const [isLoading, setLoading] = useState(true);
    const [isLoggedIn, setLoggedIn] = useState(false);
    const [loginStep, setLoginStep] = useState(0);
    const [activeTab, setActiveTab] = useState("tab1");
    const [isProfileEdit, setProfileEdit] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [age, setAge] = useState("");
    const [interests, setInterests] = useState([]);
    const [newInterest, setNewInterest] = useState("");
    const [groupInfo, setGroupInfo] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [visibleAccessCodes, setVisibleAccessCodes] = useState(new Set());
    const [openedGroups, setOpenedGroups] = useState(new Set());
    const [toast, setToast] = useState({ message: '', type: '', visible: false });
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinAccessCode, setJoinAccessCode] = useState("");
    
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
            <button className="signup-button-inline" onClick={() => setLoginStep(0)}>Back</button>
            <p>Enter an email and password to get started:</p>
            <SignupForm />
            </>
            break;
        default:
            loginElement = <>
            <LoginForm />
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                <p style={{ margin: '0 0 0.25rem 0' }}>Don't have an account?</p>
                <button className="signup-button-inline" onClick={() => setLoginStep(1)}>Click here to sign up</button>
            </div>
            </>
    }

    const submitData = async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                const userDocRef = doc(db, 'Users', user.uid);
                await updateDoc(userDocRef, {
                    firstName: firstName,
                    lastName: lastName,
                    age: parseInt(age) || null,
                    interests: interests
                });
                console.log("Profile updated successfully!");
            }
        } catch (error) {
            console.error("Error updating profile:", error);
        }
    }

    const fetchData = async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                const userDocRef = doc(db, 'Users', user.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setEmail(userData.email);
                    setFirstName(userData.firstName || '');
                    setLastName(userData.lastName || '');
                    setAge(userData.age || '');
                    setInterests(userData.interests || []);
                } else {
                    console.log("No user document found!");
                }
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }

    const fetchGroups = async () => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const userDocRef = doc(db, 'Users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (!userDoc.exists()) return;
            
            const userData = userDoc.data();
            const userGroups = userData.userGroups || [];
            
            const groupPromises = userGroups.map(groupId => 
                getDoc(doc(db, 'Groups', groupId))
            );
            
            const groupDocs = await Promise.all(groupPromises);
            const groups = groupDocs
                .filter(doc => doc.exists())
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    events: doc.data().events || []
                }));
            
            setGroupInfo(groups);
        } catch (error) {
            console.error("Error fetching groups:", error);
        }
    }

    const generateAccessCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    const createGroup = async () => {
        try {
            const user = auth.currentUser;
            if (!user || !newGroupName.trim()) return;

            // Generate a unique access code (avoid collisions in AccessCodes collection)
            let accessCode = '';
            const maxAttempts = 5;
            for (let i = 0; i < maxAttempts; i++) {
                const candidate = generateAccessCode();
                const existing = await getDoc(doc(db, 'AccessCodes', candidate));
                if (!existing.exists()) {
                    accessCode = candidate;
                    break;
                }
            }
            if (!accessCode) {
                // fallback to timestamp-based code if collision keeps happening
                accessCode = (Date.now().toString(36)).slice(-6).toUpperCase();
            }

            // Create new group document
            const groupsCollection = collection(db, 'Groups');
            const newGroupRef = await addDoc(groupsCollection, {
                name: newGroupName.trim(),
                accessCode: accessCode,
                createdAt: new Date().toISOString(),
                createdBy: user.uid,
                members: [user.uid],
                events: []
            });

            // Map access code -> group id in AccessCodes collection
            await setDoc(doc(db, 'AccessCodes', accessCode), {
                groupId: newGroupRef.id,
                createdAt: new Date().toISOString()
            });

            // Update user's groups list
            const userDocRef = doc(db, 'Users', user.uid);
            await updateDoc(userDocRef, {
                userGroups: arrayUnion(newGroupRef.id)
            });

            // Reset form and close modal
            setNewGroupName('');
            setShowCreateModal(false);

            // Refresh groups list
            await fetchGroups();

        } catch (error) {
            console.error("Error creating group:", error);
        }
    }

    const joinGroup = async (code) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const codeToUse = (code || joinAccessCode || '').trim().toUpperCase();
            if (!codeToUse) {
                showToast('Please enter an access code', 'error');
                return;
            }

            // Look up the AccessCodes collection for this code
            const accessDocRef = doc(db, 'AccessCodes', codeToUse);
            const accessDoc = await getDoc(accessDocRef);
            if (!accessDoc.exists()) {
                showToast('Access code not found', 'error');
                return;
            }

            const { groupId } = accessDoc.data();
            if (!groupId) {
                showToast('Invalid access code mapping', 'error');
                return;
            }

            // Prevent joining same group twice (check current loaded groups)
            if (groupInfo.some(g => g.id === groupId)) {
                showToast('You are already a member of this group', 'error');
                // close modal
                setJoinAccessCode('');
                setShowJoinModal(false);
                return;
            }

            // Add the group to the user's userGroups array
            const userDocRef = doc(db, 'Users', user.uid);
            await updateDoc(userDocRef, {
                userGroups: arrayUnion(groupId)
            });

            // Add the user to the group's members array
            const groupDocRef = doc(db, 'Groups', groupId);
            await updateDoc(groupDocRef, {
                members: arrayUnion(user.uid)
            });

            // Reset and close modal, refresh groups
            setJoinAccessCode('');
            setShowJoinModal(false);
            await fetchGroups();

            // Auto-open the group's details and show success toast
            setOpenedGroups(prev => {
                const newSet = new Set(prev);
                newSet.add(groupId);
                return newSet;
            });
            showToast('Joined group successfully', 'success');
        } catch (error) {
            console.error('Error joining group:', error);
            showToast('Error joining group', 'error');
        }
    }

    const leaveGroup = async (groupId) => {
        try {
            const user = auth.currentUser;
            if (!user) return;
            const groupRef = doc(db, 'Groups', groupId);
            const userRef  = doc(db, 'Users', user.uid);
            await runTransaction(db, async (tx) => {
             const groupSnap = await tx.get(groupRef);
             if (!groupSnap.exists()) return;

             const data = groupSnap.data();
             const members = Array.isArray(data.members) ? data.members : [];
             if (!members.includes(user.uid)) {
                 // Still ensure user's doc is cleaned up, just in case.
                 tx.update(userRef, { userGroups: arrayRemove(groupId) });
                 return;
             }
             const newMembers = members.filter(m => m !== user.uid);
             // Always unlink group from the user
             tx.update(userRef, { userGroups: arrayRemove(groupId) });

             if (newMembers.length > 0) {
                 // Others remain → remove this user only
                 tx.update(groupRef, { members: arrayRemove(user.uid) });
             } else {
                 // Last member → delete group and free access code
                 const accessCode = data.accessCode;
                 tx.delete(groupRef);
                 if (accessCode) {
                     const acRef = doc(db, 'AccessCodes', accessCode);
                     tx.delete(acRef);
                 }
             }
         });
            // Refresh groups list
            await fetchGroups();
        } catch (error) {
            console.error('Error leaving group:', error);
        }
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
        try {
            await submitData();
            await fetchData();
            setProfileEdit(false);
        } catch (error) {
            console.error("Error saving profile:", error);
            // You might want to show an error message to the user here
        }
    }

    const handleCancel = (e) => {
        setProfileEdit(false);
        fetchData();
    }

    const addInterest = (e) => {
        e.preventDefault();
        if (newInterest.trim()) {
            setInterests([...interests, newInterest.trim()]);
            setNewInterest('');
        }
    }

    const removeInterest = (indexToRemove) => {
        setInterests(interests.filter((_, index) => index !== indexToRemove));
    }

    const toggleAccessCode = (groupId) => {
        setVisibleAccessCodes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(groupId)) {
                newSet.delete(groupId);
            } else {
                newSet.add(groupId);
            }
            return newSet;
        });
    }

    const showToast = (message, type = 'info', duration = 3000) => {
        setToast({ message, type, visible: true });
        setTimeout(() => setToast({ message: '', type: '', visible: false }), duration);
    }

    return(
        <>
                <div className="app-header">
                    <h1>Group Activity Planner</h1>
                    {isLoggedIn && (
                        <button className="signout-button" onClick={handleLogout}>Sign Out</button>
                    )}
                </div>
                {/* Toast */}
                {toast.visible && (
                    <div style={{
                        position: 'fixed',
                        top: 84,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: toast.type === 'success' ? '#16a34a' : (toast.type === 'error' ? '#ef4444' : '#111827'),
                        color: 'white',
                        padding: '0.6rem 1rem',
                        borderRadius: 8,
                        boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
                        zIndex: 2000
                    }}>{toast.message}</div>
                )}
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
                {activeTab === "tab1" && <div className="groups-area centered">
                    <br />
                    <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center'}}>
                      <button onClick={() => setShowCreateModal(true)}>Create Group</button>
                      <button onClick={() => setShowJoinModal(true)}>Join Group</button>
                    </div>

                    {showCreateModal && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 1000
                        }}>
                            <div style={{
                                background: 'white',
                                padding: '2rem',
                                borderRadius: '8px',
                                maxWidth: '400px',
                                width: '90%'
                            }}>
                                <h3 style={{marginTop: 0}}>Create New Group</h3>
                                <div style={{marginBottom: '1rem'}}>
                                    <label htmlFor="groupName">Group Name:</label>
                                    <input
                                        type="text"
                                        id="groupName"
                                        value={newGroupName}
                                        onChange={(e) => setNewGroupName(e.target.value)}
                                        style={{width: '100%', marginTop: '0.5rem'}}
                                    />
                                </div>
                                <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'flex-end'}}>
                                    <button onClick={() => setShowCreateModal(false)}>Cancel</button>
                                    <button 
                                        onClick={createGroup}
                                        disabled={!newGroupName.trim()}
                                        style={{
                                            backgroundColor: !newGroupName.trim() ? '#ccc' : '#4f46e5'
                                        }}
                                    >
                                        Create
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showJoinModal && (
                        <div style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 1000
                        }}>
                            <div style={{
                                background: 'white',
                                padding: '1.5rem',
                                borderRadius: '8px',
                                maxWidth: '380px',
                                width: '90%'
                            }}>
                                <h3 style={{marginTop: 0}}>Join Group</h3>
                                <div style={{marginBottom: '1rem'}}>
                                    <label htmlFor="joinCode">Access Code:</label>
                                    <input
                                        id="joinCode"
                                        type="text"
                                        value={joinAccessCode}
                                        onChange={(e) => setJoinAccessCode(e.target.value)}
                                        style={{width: '100%', marginTop: '0.5rem'}}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                joinGroup();
                                            }
                                        }}
                                    />
                                </div>
                                <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'flex-end'}}>
                                    <button onClick={() => { setShowJoinModal(false); setJoinAccessCode(''); }}>Cancel</button>
                                    <button onClick={() => joinGroup()} style={{backgroundColor: joinAccessCode.trim() ? '#4f46e5' : '#ccc'}} disabled={!joinAccessCode.trim()}>Join</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <h3 style={{marginTop: '1rem'}}>My Groups:</h3>
                    <div className="group-list" style={{width: '100%'}}>
                    {groupInfo.map(group => (
                        <details key={group.id} open={openedGroups.has(group.id)}>
                            <summary>{group.name}</summary>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                padding: '0.5rem 0',
                                borderBottom: '1px solid #eef2ff',
                                marginBottom: '0.5rem'
                            }}>
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        toggleAccessCode(group.id);
                                    }}
                                    style={{
                                        fontSize: '0.9rem',
                                        padding: '0.3rem 0.6rem',
                                        background: 'linear-gradient(to right, #6366f1, #8b5cf6)'
                                    }}
                                >
                                    {visibleAccessCodes.has(group.id) ? 'Hide Access Code' : 'Show Access Code'}
                                </button>
                                {visibleAccessCodes.has(group.id) && (
                                    <div style={{
                                        
                                        background: '#f3f4f6',
                                        padding: '0.3rem 0.6rem',
                                        borderRadius: '4px',
                                        fontFamily: 'monospace',
                                        fontSize: '0.9rem'
                                    }}>
                                        Access Code: {group.accessCode}
                                    </div>
                                )}
                            </div>
                            {group.events.map(event => (
                                <details key={event.id}>
                                    <summary>{event.name}</summary>
                                    <div style={{padding: '0.25rem 0'}}> 
                                      <p>location: {event.location}</p>
                                      <p>budget: {event.budget}</p>
                                      <p>vibe: {event.vibe}</p>
                                      <div style={{display: 'flex', gap: '0.5rem'}}>
                                        <button>Edit</button>
                                        <button onClick={() => joinEvent(group.id)}>Join</button>
                                      </div>
                                    </div>
                                </details>
                            ))}
                            <div style={{marginTop: '0.5rem', display: 'flex', gap: '0.5rem'}}>
                              <button onClick={() => addEvent(group.id)}>Add Event</button>
                              <button onClick={() => leaveGroup(group.id)}>Leave Group</button>
                            </div>
                        </details>
                    ))}
                    </div>
                </div>}
                {activeTab === "tab2" && <div className="profile-area centered">
                    {isProfileEdit ? (
                        <>
                        <h3>First Name: </h3>
                        <input type="text" name="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        <h3>Last Name: </h3>
                        <input type="text" name="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        <h3>Email: </h3>
                        <input type="text" name="email" value={email} readOnly />
                        <h3>Age: </h3>
                        <input 
                            type="number" 
                            name="age" 
                            value={age} 
                            onChange={(e) => setAge(e.target.value)}
                            min="0"
                            style={{width: '80px'}}
                        />
                        <h3>Interests: </h3>
                        <div style={{marginBottom: '1rem'}}>
                            <div style={{display: 'flex', gap: '0.5rem', marginBottom: '0.5rem'}}>
                                <input
                                    type="text"
                                    value={newInterest}
                                    onChange={(e) => setNewInterest(e.target.value)}
                                    placeholder="Add a new interest"
                                    style={{flex: 1}}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addInterest(e);
                                        }
                                    }}
                                />
                                <button onClick={addInterest}>Add</button>
                            </div>
                            <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem'}}>
                                {interests.map((interest, index) => (
                                    <div key={index} style={{
                                        background: '#e0e7ff',
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem'
                                    }}>
                                        {interest}
                                        <button
                                            onClick={() => removeInterest(index)}
                                            style={{
                                                border: 'none',
                                                background: 'none',
                                                padding: '0 0.25rem',
                                                cursor: 'pointer',
                                                color: '#4f46e5'
                                            }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div style={{display: 'flex', gap: '0.5rem'}}>
                            <button onClick={handleSubmit}>Submit</button>
                            <button onClick={handleCancel}>Cancel</button>
                        </div>
                        </>
                    ) : (
                        <div style={{textAlign: 'center'}}>
                        <h3>First Name: </h3>
                        <p>{firstName}</p>
                        <h3>Last Name: </h3>
                        <p>{lastName}</p>
                        <h3>Email: </h3>
                        <p>{email}</p>
                        <h3>Age: </h3>
                        <p>{age}</p>
                        <h3>Interests: </h3>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center'}}>
                            {interests.map((interest, index) => (
                                <div key={index} style={{
                                    background: '#e0e7ff',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px'
                                }}>
                                    {interest}
                                </div>
                            ))}
                        </div>
                        <br />
                        <button onClick={() => setProfileEdit(true)}>Edit</button>
                        </div>
                    )}
                </div>}
            </div>
        </div>
        ) : (
        <div style={{ width: "100%", display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ maxWidth: 520, width: '90%', padding: '2rem 1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1.05rem', marginBottom: '1.25rem' }}>Welcome to Group Activity Planner, a website that helps you and your group find and schedule new activities. Please login or sign up to get started.</p>

                {/* Centered login box with stacked fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'stretch', margin: '0 auto' }}>
                    {/** If LoginForm provides its own inputs this will render them; otherwise we show a minimal inline form wrapper for email/password/login **/}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {loginElement}
                    </div>

                    
                </div>
            </div>
        </div>
        )}
        </>
    )
}

export default SinglePage;