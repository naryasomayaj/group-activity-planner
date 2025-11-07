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
import { generateActivityIdeas } from "../ai/geminiClient.js";

function SinglePage() {
    const auth = getAuth();
    const [llmBusy, setLlmBusy] = useState(new Set());
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
    const [isEditingEvent, setIsEditingEvent] = useState(false);
    const [editingEventId, setEditingEventId] = useState(null);
    const [mode, setMode] = useState(null); 
    const [vibeDraft, setVibeDraft] = useState("");
    const [userCache, setUserCache] = useState({});
    // Add-event modal & form state
    const [showEventModal, setShowEventModal] = useState(false);
    const [eventGroupId, setEventGroupId] = useState(null);
    const [eventForm, setEventForm] = useState({
    name: "",
    location: "",
    budget: "",        // keep as string while typing; parse on save
    vibes: [],         // array of strings (tags)
    });
    let loginElement;

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
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

    const nameOf = (uid) => {
        const u = userCache[uid];
        if (!u) return uid; // fallback
        const n = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        return n || u.email || uid;
        };

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
            try {
                const uidSet = new Set();
                groups.forEach(g => {
                    (g.members || []).forEach(u => uidSet.add(u));
                    (g.events || []).forEach(ev => {
                    const prefs = ev.preferences || {};
                    Object.keys(prefs).forEach(u => uidSet.add(u));
                    (ev.participants || []).forEach(u => uidSet.add(u));
                    });
                });

                const missing = [...uidSet].filter(u => !userCache[u]);
                if (missing.length) {
                    const docs = await Promise.all(missing.map(u => getDoc(doc(db, 'Users', u))));
                    const updates = {};
                    docs.forEach((d, i) => {
                    const uid = missing[i];
                    if (d.exists()) {
                        const ud = d.data();
                        updates[uid] = {
                        firstName: ud.firstName || '',
                        lastName: ud.lastName || '',
                        email: ud.email || ''
                        };
                    } else {
                        updates[uid] = { firstName: '', lastName: '', email: '' };
                    }
                    });
                    setUserCache(prev => ({ ...prev, ...updates }));
                }
                } catch (e) {
                console.error('Error preloading user profiles', e);
                }

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

    const resetEventForm = () => {
        setEventForm({ name: "", location: "", budget: "", vibes: [] });
        setVibeDraft("");
        setEventGroupId(null);
        setMode(null);
    }

    function buildLLMPrompt(event, groupName, nameOfFn) {
        const lines = [];
        lines.push(`You are an assistant that suggests group activity ideas.`);
        lines.push(`Group: ${groupName || "(unnamed group)"}`);
        lines.push(`Event name: ${event?.name || "—"}`);
        lines.push(`Location: ${event?.location || "—"}`);
       // lines.push(`Participants count: ${(event?.participants || []).length}`);
        lines.push(`\nParticipant preferences (per user):`);

        const prefs = event?.preferences || {};
        if (Object.keys(prefs).length === 0) {
            lines.push(`  (none yet)`);
        } else {
            Object.entries(prefs).forEach(([uid, p]) => {
            const nm = nameOfFn(uid);
            const budget = (p?.budget ?? "—");
            const vibes = Array.isArray(p?.vibes) && p.vibes.length ? p.vibes.join(", ") : "—";
            lines.push(`  - ${nm}: budget=${budget}, vibes=${vibes}`);
            });
        }

        lines.push(`
        Please propose 3–5 concrete, feasible activity ideas that fit the budgets and vibes above.
        For each idea, include:
        - Title
        - Why it fits the group's preferences
        - Rough cost per person
        - What to book/bring
        - 2–3 variations (e.g., cheaper/indoor)

        Return plain text in a readable list.`);

        return lines.join("\n");
    }



    const addEvent = async(groupId) => {
        /* This function should add an event to the specified group */
        try {
            const user = auth.currentUser;
            if (!user) return;

            if (!groupId) {
            showToast('No group selected', 'error');
            return;
            }

            const name = (eventForm.name || "").trim();
            if (!name) {
            showToast('Please enter an event name', 'error');
            return;
            }

            const location = (eventForm.location || "").trim();
            const budgetNumber = eventForm.budget === "" ? null : Number(eventForm.budget);
            if (budgetNumber !== null && Number.isNaN(budgetNumber)) {
            showToast('Budget must be a number', 'error');
            return;
            }

            const vibes = (eventForm.vibes || []).map(v => v.trim()).filter(Boolean);

            const groupRef = doc(db, 'Groups', groupId);
            const groupSnap = await getDoc(groupRef);
            if (!groupSnap.exists()) {
            showToast('Group not found', 'error');
            return;
            }

            const data = groupSnap.data();
            const currentEvents = Array.isArray(data.events) ? data.events : [];

            const newEvent = {
               id: (crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
               name,
               location,
               participants: [user.uid],
               preferences: {
                 [user.uid]: {
                   budget: budgetNumber,           // this user’s budget
                   vibes,                          // this user’s vibes
                   updatedAt: new Date().toISOString(),
                 }
               },
               createdBy: user.uid,
               createdAt: new Date().toISOString(),
             };

            await updateDoc(groupRef, { events: [...currentEvents, newEvent] });

            showToast('Event created successfully!', 'success');
            setShowEventModal(false);
            resetEventForm();
            await fetchGroups();

            setOpenedGroups(prev => {
            const s = new Set(prev);
            s.add(groupId);
            return s;
            });
        } catch (error) {
            console.error('Error creating event:', error);
            showToast('Error creating event', 'error');
        }
    }

    const updateEvent = async (groupId, eventId) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            if (!groupId || !eventId) { showToast('Missing group or event id', 'error'); return; }

            const name = (eventForm.name || "").trim();
            if (!name) { showToast('Please enter an event name', 'error'); return; }

            const location = (eventForm.location || "").trim();
            const budgetNumber = eventForm.budget === "" ? null : Number(eventForm.budget);
            if (budgetNumber !== null && Number.isNaN(budgetNumber)) {
            showToast('Budget must be a number', 'error'); return;
            }
            const vibes = (eventForm.vibes || []).map(v => v.trim()).filter(Boolean);

            const groupRef = doc(db, 'Groups', groupId);
            const snap = await getDoc(groupRef);
            if (!snap.exists()) { showToast('Group not found', 'error'); return; }

            const data = snap.data();
            const events = Array.isArray(data.events) ? data.events : [];
            const idx = events.findIndex(e => e.id === eventId);
            if (idx === -1) { showToast('Event not found', 'error'); return; }

            // Optional: restrict edits to creator only
            // if (events[idx].createdBy && events[idx].createdBy !== user.uid) {
            //   showToast('Only the creator can edit this event', 'error'); return;
            // }

            const updated = {
            ...events[idx],
            name,
            location,
            updatedAt: new Date().toISOString(),
            updatedBy: user.uid,
            };

            const newEvents = [...events];
            newEvents[idx] = updated;

            await updateDoc(groupRef, { events: newEvents });

            showToast('Event updated!', 'success');
            setShowEventModal(false);
            setIsEditingEvent(false);
            setEditingEventId(null);
            resetEventForm();
            setMode(null);
            await fetchGroups();
            setOpenedGroups(prev => new Set(prev).add(groupId));
        } catch (err) {
            console.error('Error updating event:', err);
            showToast('Error updating event', 'error');
        }
    }

    const updateMyEventPreference = async (groupId, eventId, myBudgetRaw, myVibesArr) => {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const groupRef = doc(db, 'Groups', groupId);
        const snap = await getDoc(groupRef);
        if (!snap.exists()) { showToast('Group not found', 'error'); return; }

        const data = snap.data();
        const events = Array.isArray(data.events) ? data.events : [];
        const idx = events.findIndex(e => e.id === eventId);
        if (idx === -1) { showToast('Event not found', 'error'); return; }

        const e = events[idx];
        const prefs = e.preferences || {};
        const budgetNumber = myBudgetRaw === "" ? null : Number(myBudgetRaw);
        if (budgetNumber !== null && Number.isNaN(budgetNumber)) {
        showToast('Budget must be a number', 'error');
        return;
        }

        const cleanedVibes = (myVibesArr || []).map(v => `${v}`.trim()).filter(Boolean);

        prefs[user.uid] = {
        budget: budgetNumber,
        vibes: cleanedVibes,
        updatedAt: new Date().toISOString(),
        };

        const newEvents = [...events];
        newEvents[idx] = { ...e, preferences: prefs };

        await updateDoc(groupRef, { events: newEvents });
        showToast('Saved your preference', 'success');
        setShowEventModal(false);
        resetEventForm();
        await fetchGroups();
    } catch (err) {
        console.error('Error saving preference:', err);
        showToast('Error saving preference', 'error');
    }
    };

    const deleteEvent = async (groupId, eventId) => {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const groupRef = doc(db, 'Groups', groupId);
        const snap = await getDoc(groupRef);
        if (!snap.exists()) { showToast('Group not found', 'error'); return; }

        const data = snap.data();
        const events = Array.isArray(data.events) ? data.events : [];
        const idx = events.findIndex(e => e.id === eventId);
        if (idx === -1) { showToast('Event not found', 'error'); return; }

        const event = events[idx];
        if (event.createdBy && event.createdBy !== user.uid) {
        showToast('Only the creator can delete this event', 'error');
        return;
        }

        const newEvents = events.filter(e => e.id !== eventId);
        await updateDoc(groupRef, { events: newEvents });

        showToast('Event deleted', 'success');
        await fetchGroups();
        setOpenedGroups(prev => new Set(prev).add(groupId));
    } catch (err) {
        console.error('Error deleting event:', err);
        showToast('Error deleting event', 'error');
    }
    };

    const joinEvent = async (groupId, eventId) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const groupRef = doc(db, 'Groups', groupId);
            const snap = await getDoc(groupRef);
            if (!snap.exists()) { showToast('Group not found', 'error'); return; }

            const data = snap.data();
            const events = Array.isArray(data.events) ? data.events : [];
            const idx = events.findIndex(e => e.id === eventId);
            if (idx === -1) { showToast('Event not found', 'error'); return; }

            const event = events[idx];
            const participants = Array.isArray(event.participants) ? event.participants : [];
            const prefs = event.preferences || {}; // <-- define prefs from event

            if (participants.includes(user.uid)) {
            showToast('You already joined this event', 'info');
            return;
            }

            // ensure the user has a preference stub
            const newPrefs = {
            ...prefs,
            [user.uid]: prefs[user.uid] ?? {
                budget: null,
                vibes: [],
                updatedAt: new Date().toISOString(),
            },
            };

            const updatedEvent = {
            ...event,
            participants: [...participants, user.uid],
            preferences: newPrefs,
            };

            const newEvents = [...events];
            newEvents[idx] = updatedEvent;

            await updateDoc(groupRef, { events: newEvents });

            showToast('Joined event successfully!', 'success');
            await fetchGroups();
        } catch (error) {
            console.error('Error joining event:', error);
            showToast('Error joining event', 'error');
        }
        };



    const leaveEvent = async (groupId, eventId) => {
        /* This function should leave an event specified by an event id */
        try {
            const user = auth.currentUser;
            if (!user) return;

            const groupRef = doc(db, 'Groups', groupId);
            const groupSnap = await getDoc(groupRef);
            if (!groupSnap.exists()) {
                showToast('Group not found', 'error');
                return;
            }

            const data = groupSnap.data();
            const events = Array.isArray(data.events) ? data.events : [];
            const idx = events.findIndex(e => e.id === eventId);
            if (idx === -1) {
                showToast('Event not found', 'error');
                return;
            }

            const event = events[idx];
            const participants = Array.isArray(event.participants) ? event.participants : [];

            if (participants.includes(user.uid)) {
                const updatedEvent = { ...event, participants: participants.filter(p => p !== user.uid) };
                const newEvents = [...events];
                newEvents[idx] = updatedEvent;
                await updateDoc(groupRef, { events: newEvents });
            }

            showToast('Left event successfully!', 'success');
            await fetchGroups();
    } catch (error) {
        console.error('Error leaving event:', error);
        showToast('Error leaving event', 'error');
    }

    }

    const addVibe = (e) => {
        e?.preventDefault?.();
        const v = (vibeDraft || "").trim();
        if (!v) return;
        setEventForm(prev => ({ ...prev, vibes: [...(prev.vibes || []), v] }));
        setVibeDraft("");
        };

    const removeVibe = (idx) => {
        setEventForm(prev => ({ ...prev, vibes: (prev.vibes || []).filter((_, i) => i !== idx) }));
        };



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
    const generateForEvent = async (groupId, eventId) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            // find the event in local state
            const group = groupInfo.find(g => g.id === groupId);
            if (!group) { showToast('Group not found', 'error'); return; }
            const evIdx = (group.events || []).findIndex(e => e.id === eventId);
            if (evIdx === -1) { showToast('Event not found', 'error'); return; }
            const event = group.events[evIdx];

            // mark busy
            setLlmBusy(prev => new Set(prev).add(eventId));

            // build prompt & call Gemini
            const promptText = buildLLMPrompt(event, group.name, nameOf);
            const text = await generateActivityIdeas(promptText);

            // write result back onto the event: aiResult = { text, prompt, updatedAt }
            const groupRef = doc(db, 'Groups', groupId);
            const snap = await getDoc(groupRef);
            if (!snap.exists()) { showToast('Group not found', 'error'); return; }
            const data = snap.data();
            const events = Array.isArray(data.events) ? data.events : [];
            const idx = events.findIndex(e => e.id === eventId);
            if (idx === -1) { showToast('Event not found', 'error'); return; }

            const updatedEvent = {
            ...events[idx],
            aiResult: {
                text: text || "(no output)",
                prompt: promptText,
                updatedAt: new Date().toISOString(),
            },
            };
            const newEvents = [...events];
            newEvents[idx] = updatedEvent;

            await updateDoc(groupRef, { events: newEvents });

            // refresh view
            await fetchGroups();
            showToast('Ideas generated!', 'success');
        } catch (e) {
            console.error('LLM generation failed:', e);
            showToast(e?.message || 'Generation failed', 'error');
        } finally {
            setLlmBusy(prev => {
            const s = new Set(prev);
            s.delete(eventId);
            return s;
            });
        }
    };


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

                    {showEventModal && (
                        <div style={{
                            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
                        }}>
                            <div style={{
                            background: 'white', padding: '1.5rem', borderRadius: 8,
                            width: 'min(520px, 92%)'
                            }}>
                            <h3 style={{ marginTop: 0 }}>{isEditingEvent ? 'Edit Event' : 'Create Event'}</h3>

                            <label style={{ display: 'block', marginTop: 8 }}>Name</label>
                            <input
                                type="text"
                                value={eventForm.name}
                                onChange={(e) => setEventForm(prev => ({ ...prev, name: e.target.value }))}
                                style={{ width: '100%' }}
                            />

                            <label style={{ display: 'block', marginTop: 12 }}>Location</label>
                            <input
                                type="text"
                                value={eventForm.location}
                                onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                                style={{ width: '100%' }}
                            />

                            <label style={{ display: 'block', marginTop: 12 }}>Budget</label>
                            <input
                                type="number"
                                min="0" step="1"
                                value={eventForm.budget}
                                onChange={(e) => setEventForm(prev => ({ ...prev, budget: e.target.value }))}
                                style={{ width: 160 }}
                            />

                            <label style={{ display: 'block', marginTop: 12 }}>Vibes</label>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                                <input
                                    type="text"
                                    placeholder="e.g., chill, outdoors, foodie"
                                    value={vibeDraft}
                                    onChange={(e) => setVibeDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); addVibe(); }
                                    }}
                                    style={{ flex: 1 }}
                                />
                                <button onClick={addVibe}>Add</button>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {(eventForm.vibes || []).map((v, i) => (
                                    <div key={`${v}-${i}`} style={{
                                    background: '#e0e7ff',
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6
                                    }}>
                                    {v}
                                    <button
                                        onClick={() => removeVibe(i)}
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#4f46e5' }}
                                        title="Remove"
                                    >
                                        ×
                                    </button>
                                    </div>

                                    
                                ))}
                            </div>


                            

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                            <button onClick={() => {
                                setShowEventModal(false);
                                setIsEditingEvent(false);
                                setEditingEventId(null);
                                resetEventForm();
                            }}>
                                Cancel
                            </button>

                            <button
                                onClick={() => {
                                if (mode === 'myPref') {
                                    updateMyEventPreference(eventGroupId, editingEventId, eventForm.budget, eventForm.vibes);
                                    } else if (isEditingEvent) {
                                    updateEvent(eventGroupId, editingEventId);
                                    } else {
                                    addEvent(eventGroupId);
                                    }
                                }}
                                disabled={!eventForm.name.trim() || !eventGroupId}
                                style={{ background: (!eventForm.name.trim() || !eventGroupId) ? '#ccc' : '#4f46e5' }}
                            >
                                {mode === 'myPref' ? 'Save My Preference' : (isEditingEvent ? 'Save Changes' : 'Create')}
                            </button>
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
                                        padding: '0.3rem 0.6rem'
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
                            {group.events.map(event => {
                                const isParticipant = Array.isArray(event.participants) && auth.currentUser && event.participants.includes(auth.currentUser.uid);
                                const amCreator = auth.currentUser && event.createdBy === auth.currentUser.uid;

                                return (
                                    <details key={event.id}>
                                    <summary>{event.name}</summary>
                                    <div style={{padding: '0.25rem 0'}}> 
                                        <p>location: {event.location || '—'}</p>

                                        <div style={{ marginTop: 8 }}>
                                        <strong>Preferences:</strong>
                                        <div style={{ marginTop: 6 }}>
                                            {event.preferences && Object.keys(event.preferences).length > 0 ? (
                                            Object.entries(event.preferences).map(([uid, p]) => (
                                                <div key={uid} style={{ marginBottom: 4 }}>
                                                <span style={{ fontWeight: 600 }}>{nameOf(uid)}:</span>{' '}
                                                <span>budget: {p?.budget ?? '—'}</span>{' '}
                                                <span>• vibes: {Array.isArray(p?.vibes) && p.vibes.length ? p.vibes.join(', ') : '—'}</span>
                                                </div>
                                            ))
                                            ) : (
                                            <em>No preferences yet</em>
                                            )}
                                        </div>
                                        </div>

                                        {event.aiResult?.text && (
                                        <div style={{ marginTop: 12 }}>
                                            <strong>AI Suggestions:</strong>
                                            <pre
                                            style={{
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                background: '#f8f8f8',
                                                padding: 12,
                                                borderRadius: 8
                                            }}
                                            >
                                            {event.aiResult.text}
                                            </pre>
                                        </div>
                                        )}

                                        <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                                        {!isParticipant ? (
                                            <button onClick={() => joinEvent(group.id, event.id)}>Join</button>
                                        ) : (
                                            <button onClick={() => leaveEvent(group.id, event.id)}>Leave</button>
                                        )}

                                        <button
                                        onClick={() => {
                                            const my = (event.preferences && event.preferences[auth.currentUser?.uid]) || {};
                                            setEventForm({
                                            name: event.name || "",
                                            location: event.location || "",
                                            budget: (my.budget ?? "") === null ? "" : (my.budget ?? ""),
                                            vibes: Array.isArray(my.vibes) ? my.vibes : [],
                                            });
                                            setVibeDraft("");
                                            setEventGroupId(group.id);
                                            setEditingEventId(event.id);
                                            setIsEditingEvent(false);
                                            setShowEventModal(true);
                                            setMode('myPref');  // IMPORTANT: saves via updateMyEventPreference
                                        }}
                                        >
                                        Edit My Preference
                                        </button>

                                        {amCreator && (
                                            <button
                                            onClick={() => deleteEvent(group.id, event.id)}
                                            style={{ background: '#ef4444', color: '#fff' }}
                                            >
                                            Delete
                                            </button>
                                        )}

                                        <button
                                            onClick={() => generateForEvent(group.id, event.id)}
                                            disabled={llmBusy.has(event.id)}
                                            >
                                            {llmBusy.has(event.id) ? 'Generating…' : 'Generate ideas'}
                                        </button>
                                        </div>
                                    </div>
                                    </details>
                                );
                                })}

                            <div style={{marginTop: '0.5rem', display: 'flex', gap: '0.5rem'}}>
                              <button onClick={() => {
                                resetEventForm();
                                setIsEditingEvent(false);
                                setEditingEventId(null);
                                setEventGroupId(group.id);
                                setShowEventModal(true);
                                setMode('event');
                                }}>
                                Add Event
                                </button>
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