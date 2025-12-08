/**
 * Group Activity Planner
 * Project for the Course CS 520
 *
 * Single-page React app that:
 * - Handles auth (login/signup) via Firebase Authentication
 * - Stores user profiles in Firestore (Users collection)
 * - Lets users create/join groups using access codes (Groups + AccessCodes collections)
 * - Lets users create events, join/leave events, set preferences
 * - Calls an LLM to generate activity ideas per event
 * - Supports group voting on generated activities
 */

import { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc, collection, addDoc, arrayUnion, arrayRemove, setDoc, runTransaction, onSnapshot } from 'firebase/firestore';
import LoginForm from '../components/LoginForm';
import SignupForm from '../components/SignUpForm';
import ActivitiesViewer from '../components/ActivitiesViewer.jsx';
import AILoading from '../components/AILoading.jsx';
import { generateActivityIdeas } from "../ai/geminiClient.js";

// UI Components
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import GroupCard from '../components/GroupCard';
import EventCard from '../components/EventCard';
import Modal from '../components/Modal';
import SideDrawer from '../components/ui/SideDrawer';

function SinglePage() {
    const auth = getAuth();
    // Tracks which event IDs are currently being processed by the LLM (disables Generate Ideas button)
    const [llmBusy, setLlmBusy] = useState(new Set());
    const [isLoggedIn, setLoggedIn] = useState(false);
    const [loginStep, setLoginStep] = useState(0);

    // Navigation State
    const [activeTab, setActiveTab] = useState("groups"); // 'groups' | 'profile'
    const [selectedGroup, setSelectedGroup] = useState(null); // null | group object

    // Profile State
    const [isProfileEdit, setProfileEdit] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [age, setAge] = useState("");
    const [interests, setInterests] = useState([]);
    const [newInterest, setNewInterest] = useState("");

    // Data State
    const [groupInfo, setGroupInfo] = useState([]);
    const [userCache, setUserCache] = useState({});

    // UI State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [visibleAccessCodes, setVisibleAccessCodes] = useState(new Set());
    const [toast, setToast] = useState({ message: '', type: '', visible: false });
    const [showJoinModal, setShowJoinModal] = useState(false);
    const [joinAccessCode, setJoinAccessCode] = useState("");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [theme, setTheme] = useState(() => {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        return 'light';
    });

    // Apply theme to document root whenever `theme` changes
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    // Event State
    const [showEventModal, setShowEventModal] = useState(false);
    const [showEventDrawer, setShowEventDrawer] = useState(false);
    const [isEditingEvent, setIsEditingEvent] = useState(false);
    const [editingEventId, setEditingEventId] = useState(null);
    const [mode, setMode] = useState(null);
    const [vibeDraft, setVibeDraft] = useState("");
    const [eventGroupId, setEventGroupId] = useState(null);

    // Form used both for event creation and editing preferences (budget/vibes/date)
    const [eventForm, setEventForm] = useState({
        name: "",
        location: "",
        budget: "",
        vibes: [],
        interests: [],
        date: "" 
    });
    const [showJoinConfirmationModal, setShowJoinConfirmationModal] = useState(false);
    const [selectedEventForJoin, setSelectedEventForJoin] = useState(null);

    // Auth Listener
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            if (user) {
                fetchData();
                fetchGroups();
                setLoggedIn(true);
            } else {
                setLoggedIn(false);
                setSelectedGroup(null);
                setActiveTab("groups");
            }
        });
        return unsubscribe;
    }, []);

    // REAL-TIME GROUP LISTENER 
    //
    // When a group is selected, subscribe to that group's document in Firestore
    // so event updates, new participants, voting, etc. appear in real-time.
    useEffect(() => {
        if (!selectedGroup?.id) return;

        const unsub = onSnapshot(doc(db, 'Groups', selectedGroup.id), (doc) => {
            if (doc.exists()) {
                const data = { id: doc.id, ...doc.data(), events: doc.data().events || [] };
                setSelectedGroup(data);

                // Also update the group in the list to keep it in sync
                setGroupInfo(prev => prev.map(g => g.id === data.id ? data : g));
            }
        });

        return () => unsub();
    }, [selectedGroup?.id]);

    // AUTH /LOGOUT HANDLER
    const handleLogout = async (e) => {
        try {
            await signOut(auth);
            console.log("User signed out!");
        } catch (e) {
            console.error("Error signing out:", e);
        }
    }

    // Profile Logic

    /* Writes the current in-memory profile state to Firestore (Users/{uid}).
     * Uses setDoc with merge: true so we don't overwrite unrelated fields.
     */

    const submitData = async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                const userDocRef = doc(db, 'Users', user.uid);
                // CRITICAL FIX: Use setDoc with merge: true
                await setDoc(userDocRef, {
                    firstName: firstName,
                    lastName: lastName,
                    age: parseInt(age) || null,
                    interests: interests
                }, { merge: true });
                console.log("Profile updated successfully!");
                showToast("Profile saved successfully", "success");
            }
        } catch (error) {
            console.error("Error updating profile:", error);
            showToast("Error saving profile", "error");
        }
    }
    //Loads current user's profile document from Firestore into React state.
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
    
    // Saves profile changes and reloads from Firestore to keep state consistent.
     
    const handleSubmit = async (e) => {
        try {
            await submitData();
            await fetchData();
            setProfileEdit(false);
        } catch (error) {
            console.error("Error saving profile:", error);
        }
    }
    //Cancels profile editing and reloads last-saved data from Firestore.
    const handleCancel = (e) => {
        setProfileEdit(false);
        fetchData();
    }
    //Adds a new interest string to the interests array.
    const addInterest = (e) => {
        e.preventDefault();
        if (newInterest.trim()) {
            setInterests([...interests, newInterest.trim()]);
            setNewInterest('');
        }
    }
    //Removes an interest by index
    const removeInterest = (indexToRemove) => {
        setInterests(interests.filter((_, index) => index !== indexToRemove));
    }

    // Group Logic
    const nameOf = (uid) => {
        const u = userCache[uid];
        if (!u) return uid;
        const n = `${u.firstName || ''} ${u.lastName || ''}`.trim();
        return n || u.email || uid;
    };
    //Fetches all groups the current user is a member of.
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

            // If we have a selected group, update it with fresh data
            if (selectedGroup) {
                const updatedSelected = groups.find(g => g.id === selectedGroup.id);
                if (updatedSelected) {
                    setSelectedGroup(updatedSelected);
                } else {
                    // Group might have been deleted or user removed
                    setSelectedGroup(null);
                }
            }

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
                                email: ud.email || '',
                                interests: Array.isArray(ud.interests) ? ud.interests : []
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

    // Generates a short random uppercase access code, e.g. "X7Y2Z9".
    const generateAccessCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
    /**
     * Creates a new group:
     * - Generates a unique access code (with fallback)
     * - Adds a document in Groups collection
     * - Stores accessCode -> groupId mapping in AccessCodes collection
     * - Adds groupId to current user's `userGroups` array
     */
    const createGroup = async () => {
        try {
            const user = auth.currentUser;
            if (!user || !newGroupName.trim()) return;

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
                accessCode = (Date.now().toString(36)).slice(-6).toUpperCase();
            }

            const groupsCollection = collection(db, 'Groups');
            const newGroupRef = await addDoc(groupsCollection, {
                name: newGroupName.trim(),
                accessCode: accessCode,
                createdAt: new Date().toISOString(),
                createdBy: user.uid,
                members: [user.uid],
                events: []
            });

            await setDoc(doc(db, 'AccessCodes', accessCode), {
                groupId: newGroupRef.id,
                createdAt: new Date().toISOString()
            });

            const userDocRef = doc(db, 'Users', user.uid);
            await updateDoc(userDocRef, {
                userGroups: arrayUnion(newGroupRef.id)
            });

            setNewGroupName('');
            setShowCreateModal(false);
            await fetchGroups();
            showToast("Group created successfully", "success");

        } catch (error) {
            console.error("Error creating group:", error);
            showToast("Error creating group", "error");
        }
    }
    
    /**
     * Allows a user to join a group using an access code.
     * Validates:
     * - code exists in AccessCodes
     * - mapped groupId exists
     * - user isn't already a member
     */
    const joinGroup = async (code) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const codeToUse = (code || joinAccessCode || '').trim().toUpperCase();
            if (!codeToUse) {
                showToast('Please enter an access code', 'error');
                return;
            }

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

            if (groupInfo.some(g => g.id === groupId)) {
                showToast('You are already a member of this group', 'error');
                setJoinAccessCode('');
                setShowJoinModal(false);
                return;
            }

            const userDocRef = doc(db, 'Users', user.uid);
            await updateDoc(userDocRef, {
                userGroups: arrayUnion(groupId)
            });

            const groupDocRef = doc(db, 'Groups', groupId);
            await updateDoc(groupDocRef, {
                members: arrayUnion(user.uid)
            });

            setJoinAccessCode('');
            setShowJoinModal(false);
            await fetchGroups();
            showToast('Joined group successfully', 'success');
        } catch (error) {
            console.error('Error joining group:', error);
            showToast('Error joining group', 'error');
        }
    }
    /**
     * Allows a user to leave a group.
     * If the last member leaves:
     *  - deletes the group document
     *  - deletes its access code mapping
     * Uses a Firestore transaction to keep user and group documents in sync.
     */
    const leaveGroup = async (groupId) => {
        try {
            const user = auth.currentUser;
            if (!user) return;
            const groupRef = doc(db, 'Groups', groupId);
            const userRef = doc(db, 'Users', user.uid);
            await runTransaction(db, async (tx) => {
                const groupSnap = await tx.get(groupRef);
                if (!groupSnap.exists()) return;

                const data = groupSnap.data();
                const members = Array.isArray(data.members) ? data.members : [];
                if (!members.includes(user.uid)) {
                    tx.update(userRef, { userGroups: arrayRemove(groupId) });
                    return;
                }
                const newMembers = members.filter(m => m !== user.uid);
                tx.update(userRef, { userGroups: arrayRemove(groupId) });

                if (newMembers.length > 0) {
                    tx.update(groupRef, { members: arrayRemove(user.uid) });
                } else {
                    const accessCode = data.accessCode;
                    tx.delete(groupRef);
                    if (accessCode) {
                        const acRef = doc(db, 'AccessCodes', accessCode);
                        tx.delete(acRef);
                    }
                }
            });
            setSelectedGroup(null); // Go back to list
            await fetchGroups();
            showToast("Left group", "success");
        } catch (error) {
            console.error('Error leaving group:', error);
            showToast("Error leaving group", "error");
        }
    }

    // Event Logic
    const resetEventForm = () => {
        setEventForm({ name: "", location: "", budget: "", vibes: [], interests: Array.isArray(interests) ? interests : [], date: "" });
        setVibeDraft("");
        setEventGroupId(null);
        setMode(null);
    }

    /**
     * Builds the text prompt for the LLM given:
     * - event metadata (name, location)
     * - group name
     * - per-user preferences (budget, vibes, interests)
     *
     * The LLM is instructed to only suggest activities that actually exist
     * in/near the chosen location and to return JSON.
     */

    function buildLLMPrompt(event, groupName, nameOfFn) {
        const lines = [];
        lines.push(`You are an assistant that suggests group activity ideas.`);
        lines.push(`Group: ${groupName || "(unnamed group)"}`);
        lines.push(`Event name: ${event?.name || "—"}`);
        lines.push(`Location: ${event?.location || "—"}`);
        lines.push(`\nParticipant preferences (per user):`);

        const prefs = event?.preferences || {};
        if (Object.keys(prefs).length === 0) {
            lines.push(`  (none yet)`);
        } else {
            Object.entries(prefs).forEach(([uid, p]) => {
                const nm = nameOfFn(uid);
                const budget = (p?.budget ?? "—");
                const vibes = Array.isArray(p?.vibes) && p.vibes.length ? p.vibes.join(", ") : "—";
                const interests = Array.isArray(p?.interests) && p.interests.length ? p.interests.join(", ") : "—";
                lines.push(`  - ${nm}: budget=${budget}, vibes=${vibes}, interests=${interests}`);
            });
        }

        lines.push(`
        Please propose 3–5 concrete, feasible activity ideas that fit the budgets and vibes above.
        Please suggest only based on the event location,vibe and budget provided, suggest only activities that actually exist in or near that location.
        Please return your ideas as a JSON formatted like so:
{
  "activities": [
    {
      "title": "Activity 1 Title",
      "description": "activity 1 description"
    },
    {
      "title": "Activity 2 Title",
      "description": "Activity 2 Description"
    },
  ]
}
    `);
        return lines.join("\n");
    }

    /**
     * Creates a new event inside a group.
     * - Validates name and budget
     * - Adds a new event object to group's `events` array
     * Returns the new event ID so that the caller can immediately open
     * the "Edit My Preferences" view for that event.
     */
    const addEvent = async (groupId) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            if (!groupId) { showToast('No group selected', 'error'); return; }

            const name = (eventForm.name || "").trim();
            if (!name) { showToast('Please enter an event name', 'error'); return; }

            const location = (eventForm.location || "").trim();
            const date = (eventForm.date || "").trim(); // Get date from form
            const budgetNumber = eventForm.budget === "" ? null : Number(eventForm.budget);
            if (budgetNumber !== null && Number.isNaN(budgetNumber)) {
                showToast('Budget must be a number', 'error');
                return;
            }

            const vibes = (eventForm.vibes || []).map(v => v.trim()).filter(Boolean);
            const finalVibes = vibes.length ? vibes : (Array.isArray(interests) ? interests.map(v => `${v}`.trim()).filter(Boolean) : []);

            const groupRef = doc(db, 'Groups', groupId);
            const groupSnap = await getDoc(groupRef);
            if (!groupSnap.exists()) { showToast('Group not found', 'error'); return; }

            const data = groupSnap.data();
            const currentEvents = Array.isArray(data.events) ? data.events : [];

            const newEvent = {
                id: (crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
                name,
                location,
                date, // Save date
                participants: [user.uid],
                preferences: {
                    [user.uid]: {
                        budget: null, // Defer budget
                        vibes: [], // Defer vibes
                        interests: Array.isArray(interests) ? interests : [], // Initialize interests
                        updatedAt: new Date().toISOString(),
                    }
                },
                createdBy: user.uid,
                createdAt: new Date().toISOString(),
            };

            await updateDoc(groupRef, { events: [...currentEvents, newEvent] });

            showToast('Event created successfully!', 'success');
            // Don't close modal or reset form yet, we'll switch to preferences mode
            await fetchGroups();
            return newEvent.id; // Return the new ID
        } catch (error) {
            console.error('Error creating event:', error);
            showToast('Error creating event', 'error');
            return null;
        }
    }
    
    //Updates event metadata (name, location, date)
    const updateEvent = async (groupId, eventId) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            if (!groupId || !eventId) { showToast('Missing group or event id', 'error'); return; }

            const name = (eventForm.name || "").trim();
            if (!name) { showToast('Please enter an event name', 'error'); return; }

            const location = (eventForm.location || "").trim();
            const date = (eventForm.date || "").trim();
            const budgetNumber = eventForm.budget === "" ? null : Number(eventForm.budget);
            if (budgetNumber !== null && Number.isNaN(budgetNumber)) {
                showToast('Budget must be a number', 'error'); return;
            }

            const groupRef = doc(db, 'Groups', groupId);
            const snap = await getDoc(groupRef);
            if (!snap.exists()) { showToast('Group not found', 'error'); return; }

            const data = snap.data();
            const events = Array.isArray(data.events) ? data.events : [];
            const idx = events.findIndex(e => e.id === eventId);
            if (idx === -1) { showToast('Event not found', 'error'); return; }

            const updated = {
                ...events[idx],
                name,
                location,
                date,
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
        } catch (err) {
            console.error('Error updating event:', err);
            showToast('Error updating event', 'error');
        }
    }
    /**
     * Saves the current user's preferences for a given event:
     * - budget
     * - vibes
     * - interests (snapshotted from profile at save time)
     */
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
                interests: Array.isArray(interests) ? interests : [], // Persist current profile interests
                updatedAt: new Date().toISOString(),
            };

            const newEvents = [...events];

            // Self-healing: Ensure user is in participants list
            const currentParticipants = Array.isArray(e.participants) ? e.participants : [];
            let updatedParticipants = [...currentParticipants];
            if (!updatedParticipants.includes(user.uid)) {
                updatedParticipants.push(user.uid);
            }

            newEvents[idx] = { ...e, preferences: prefs, participants: updatedParticipants };

            await updateDoc(groupRef, { events: newEvents });
            showToast('Saved your preference', 'success');
            setShowEventModal(false);
            resetEventForm();

            // Open drawer if not already open (e.g. after joining)
            if (!showEventDrawer) {
                setEditingEventId(eventId);
                setEventGroupId(groupId);
                setMode('view');
                setShowEventDrawer(true);
            }

            await fetchGroups();
        } catch (err) {
            console.error('Error saving preference:', err);
            showToast('Error saving preference', 'error');
        }
    };
    /**
     * Deletes an event from a group.
     * Only the event creator is allowed to delete.
     */
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
            setShowEventDrawer(false); // Close drawer
            await fetchGroups();
        } catch (err) {
            console.error('Error deleting event:', err);
            showToast('Error deleting event', 'error');
        }
    };
    const joinEventAndEditPrefs = async () => {
            if (!selectedEventForJoin || !selectedGroup) return;

            const success = await joinEvent(selectedGroup.id, selectedEventForJoin.id);
            setShowJoinConfirmationModal(false);

            if (!success) return; // Stop if join failed

            if (!success) return; // Stop if join failed

            // Open Side Drawer directly
            const event = selectedEventForJoin;
            setEditingEventId(event.id);
            setEventGroupId(selectedGroup.id);
            setMode('view');
            setShowEventDrawer(true);
            setSelectedEventForJoin(null);
        };
    //Adds the current user as a participant in an event.
    const joinEvent = async (groupId, eventId) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const groupRef = doc(db, 'Groups', groupId);
            const snap = await getDoc(groupRef);
            if (!snap.exists()) { showToast('Group not found', 'error'); return false; }

            const data = snap.data();
            const events = Array.isArray(data.events) ? data.events : [];
            const idx = events.findIndex(e => e.id === eventId);
            if (idx === -1) { showToast('Event not found', 'error'); return false; }

            const event = events[idx];
            const participants = Array.isArray(event.participants) ? event.participants : [];
            const prefs = event.preferences || {};
            const profileVibes = Array.isArray(interests) && interests.length ? interests : [];
            if (participants.includes(user.uid)) {
                showToast('You already joined this event', 'info');
                return false;
            }

            const newPrefs = {
                ...prefs,
                [user.uid]: prefs[user.uid] ?? {
                    budget: null,
                    vibes: [], // Start with empty vibes
                    interests: profileVibes, // Store profile interests separately
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
            return true;
        } catch (error) {
            console.error('Error joining event:', error);
            showToast('Error joining event', 'error');
            return false;
        }
    };
    /**
     * Removes the current user from an event's participants list.
     */
    const leaveEvent = async (groupId, eventId) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const groupRef = doc(db, 'Groups', groupId);
            const groupSnap = await getDoc(groupRef);
            if (!groupSnap.exists()) { showToast('Group not found', 'error'); return; }

            const data = groupSnap.data();
            const events = Array.isArray(data.events) ? data.events : [];
            const idx = events.findIndex(e => e.id === eventId);
            if (idx === -1) { showToast('Event not found', 'error'); return; }

            const event = events[idx];
            const participants = Array.isArray(event.participants) ? event.participants : [];

            if (participants.includes(user.uid)) {
                const updatedEvent = { ...event, participants: participants.filter(p => p !== user.uid) };
                const newEvents = [...events];
                newEvents[idx] = updatedEvent;
                await updateDoc(groupRef, { events: newEvents });
            }

            showToast('Left event successfully!', 'success');
            setShowEventDrawer(false); // Close drawer
            await fetchGroups();
        } catch (error) {
            console.error('Error leaving event:', error);
            showToast('Error leaving event', 'error');
        }
    }
    //Adds one vibe in an event
    const addVibe = (e) => {
        e?.preventDefault?.();
        const v = (vibeDraft || "").trim();
        if (!v) return;
        setEventForm(prev => ({ ...prev, vibes: [...(prev.vibes || []), v] }));
        setVibeDraft("");
    };
    // Removes a vibe from eventForm
    const removeVibe = (idx) => {
        setEventForm(prev => ({ ...prev, vibes: (prev.vibes || []).filter((_, i) => i !== idx) }));
    };

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
    /**
     * Calls the LLM (Gemini) to generate activity ideas for a specific event.
     * - Builds prompt from event + preferences
     * - Stores result under event.aiResult
     * - Marks event ID in llmBusy while request is in-flight
     */
    const generateForEvent = async (groupId, eventId) => {
        try {
            const user = auth.currentUser;
            if (!user) return;

            const group = groupInfo.find(g => g.id === groupId);
            if (!group) { showToast('Group not found', 'error'); return; }
            const evIdx = (group.events || []).findIndex(e => e.id === eventId);
            if (evIdx === -1) { showToast('Event not found', 'error'); return; }
            const event = group.events[evIdx];

            setLlmBusy(prev => new Set(prev).add(eventId));

            const promptText = buildLLMPrompt(event, group.name, nameOf);
            const text = await generateActivityIdeas(promptText);

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

    // Voting Logic (kept as is)

    // Voting is stored inside each event under `event.voting`:

    /**
     * Opens voting for an event's generated activities.
     * - Requires aiResult.text be present
     * - Parses the JSON for "activities"
     * - Sets voting.isOpen = true and clears previous votes
     */
    const startVoting = async (groupId, eventId) => {
        // ... (same logic, just ensure it uses correct state/db)
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
            if (!event.aiResult?.text) { showToast('Please generate ideas first', 'error'); return; }
            let activities = [];
            try {
                const match = event.aiResult.text.match(/\{[\s\S]*\}/);
                if (!match) throw new Error('Invalid AI response');
                const parsed = JSON.parse(match[0]);
                activities = parsed.activities || [];
            } catch (e) { showToast('Failed to parse AI result', 'error'); return; }
            if (activities.length === 0) { showToast('No activities to vote on', 'error'); return; }
            const updatedEvent = { ...event, voting: { isOpen: true, votes: {}, startedAt: new Date().toISOString(), startedBy: user.uid } };
            const newEvents = [...events];
            newEvents[idx] = updatedEvent;
            await updateDoc(groupRef, { events: newEvents });
            await fetchGroups();
            showToast('Voting started!', 'success');
        } catch (err) { console.error('Error starting voting:', err); showToast('Error starting voting', 'error'); }
    };
    /**
     * Records a single user's vote for a specific activity index.
     * - Only participants can vote
     * - If all participants have voted, automatically calls closeVoting
     */
    const castVote = async (groupId, eventId, activityIndex) => {
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
            if (!participants.includes(user.uid)) { showToast('Only participants can vote', 'error'); return; }
            if (!event.voting?.isOpen) { showToast('Voting is not open', 'error'); return; }
            const updatedVoting = { ...event.voting, votes: { ...event.voting.votes, [user.uid]: activityIndex } };
            const updatedEvent = { ...event, voting: updatedVoting };
            const newEvents = [...events];
            newEvents[idx] = updatedEvent;
            await updateDoc(groupRef, { events: newEvents });
            const totalVotes = Object.keys(updatedVoting.votes).length;
            if (totalVotes === participants.length) { await closeVoting(groupId, eventId); } else { await fetchGroups(); showToast('Vote recorded!', 'success'); }
        } catch (err) { console.error('Error casting vote:', err); showToast('Error casting vote', 'error'); }
    };
    /**
     * Closes voting and selects a winning activity:
     * - Parses activities from aiResult.text
     * - Tallies votes per activity index
     * - Finds max vote count
     * - If tie, randomly picks one among tied indices
     * - Stores winner metadata under voting.winner
     */
    const closeVoting = async (groupId, eventId) => {
        try {
            const groupRef = doc(db, 'Groups', groupId);
            const snap = await getDoc(groupRef);
            if (!snap.exists()) { showToast('Group not found', 'error'); return; }
            const data = snap.data();
            const events = Array.isArray(data.events) ? data.events : [];
            const idx = events.findIndex(e => e.id === eventId);
            if (idx === -1) { showToast('Event not found', 'error'); return; }
            const event = events[idx];
            if (!event.voting?.isOpen) { showToast('Voting is not open', 'error'); return; }
            let activities = [];
            try {
                const match = event.aiResult.text.match(/\{[\s\S]*\}/);
                if (!match) throw new Error('Invalid AI response');
                const parsed = JSON.parse(match[0]);
                activities = parsed.activities || [];
            } catch (e) { return; }
            const voteCounts = {};
            const votes = event.voting.votes || {};
            Object.values(votes).forEach(activityIndex => { voteCounts[activityIndex] = (voteCounts[activityIndex] || 0) + 1; });
            let winnerIndex = 0;
            let maxVotes = 0;
            Object.entries(voteCounts).forEach(([idx, count]) => { if (count > maxVotes) { maxVotes = count; } });
            const tiedWinners = [];
            Object.entries(voteCounts).forEach(([idx, count]) => { if (count === maxVotes) { tiedWinners.push(parseInt(idx)); } });
            if (tiedWinners.length > 0) { const randomIndex = Math.floor(Math.random() * tiedWinners.length); winnerIndex = tiedWinners[randomIndex]; }
            const winner = activities[winnerIndex];
            const updatedVoting = { ...event.voting, isOpen: false, winner: { index: winnerIndex, title: winner?.title || 'Unknown', description: winner?.description || '', voteCount: maxVotes, wasTied: tiedWinners.length > 1, closedAt: new Date().toISOString() } };
            const updatedEvent = { ...event, voting: updatedVoting };
            const newEvents = [...events];
            newEvents[idx] = updatedEvent;
            await updateDoc(groupRef, { events: newEvents });
            await fetchGroups();
            showToast('Voting closed! Winner selected.', 'success');
        } catch (err) { console.error('Error closing voting:', err); showToast('Error closing voting', 'error'); }
    };
    
    /**
     * Clears voting state for an event.
     * Only the event creator can reset voting.
     */
    const resetVoting = async (groupId, eventId) => {
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
            if (event.createdBy && event.createdBy !== user.uid) { showToast('Only the event creator can reset voting', 'error'); return; }
            const updatedEvent = { ...event, voting: null };
            const newEvents = [...events];
            newEvents[idx] = updatedEvent;
            await updateDoc(groupRef, { events: newEvents });
            await fetchGroups();
            showToast('Voting reset', 'success');
        } catch (err) { console.error('Error resetting voting:', err); showToast('Error resetting voting', 'error'); }
    };

    const showToast = (message, type = 'info', duration = 3000) => {
        setToast({ message, type, visible: true });
        setTimeout(() => setToast({ message: '', type: '', visible: false }), duration);
    }

    // Render Helpers
    const renderLogin = () => {
        if (loginStep === 1) {
            return (
                <Card className="p-6 w-full max-w-md mx-auto">
                    <h2 className="text-2xl font-bold mb-4 text-center">Sign Up</h2>
                    <SignupForm />
                    <div className="mt-4 text-center">
                        <Button variant="ghost" onClick={() => setLoginStep(0)}>Back to Login</Button>
                    </div>
                </Card>
            );
        }
        return (
            <Card className="p-6 w-full max-w-md mx-auto">
                <h2 className="text-2xl font-bold mb-4 text-center">Login</h2>
                <LoginForm />
                <div className="mt-4 text-center">
                    <p className="text-muted-foreground mb-2">Don't have an account?</p>
                    <Button variant="ghost" onClick={() => setLoginStep(1)}>Sign Up</Button>
                </div>
            </Card>
        );
    };

    const renderSidebar = () => (
        <>
            <div className={`sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`} onClick={() => setIsSidebarOpen(false)} />
            <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-title">
                        <span>🚀 Activity Planner</span>
                    </div>
                </div>
                <div className="sidebar-nav">
                    <button
                        className={`nav-item ${activeTab === 'groups' && !selectedGroup ? 'active' : ''}`}
                        onClick={() => { setActiveTab('groups'); setSelectedGroup(null); }}
                    >
                        My Groups
                    </button>
                    {activeTab === 'groups' && (
                        <div className="nav-sub-items">
                            <button className="nav-sub-item" onClick={() => setShowCreateModal(true)}>
                                + Create Group
                            </button>
                            <button className="nav-sub-item" onClick={() => setShowJoinModal(true)}>
                                → Join Group
                            </button>
                        </div>
                    )}
                    <button
                        className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('profile'); setSelectedGroup(null); }}
                    >
                        My Profile
                    </button>
                </div>
            </div>
        </>
    );

    const renderGroups = () => (
        <div className="groups-view">
            <div className="page-header">
                <h1 className="page-title">My Groups</h1>
            </div>

            {groupInfo.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon">👥</div>
                    <p className="empty-text">No groups yet. Create one or join with a code!</p>
                    <div className="flex gap-4">
                        <Button onClick={() => setShowCreateModal(true)}>Create Group</Button>
                        <Button variant="secondary" onClick={() => setShowJoinModal(true)}>Join Group</Button>
                    </div>
                </div>
            ) : (
                <div className="card-grid">
                    {groupInfo.map(group => (
                        <GroupCard
                            key={group.id}
                            group={group}
                            onClick={() => setSelectedGroup(group)}
                        />
                    ))}
                </div>
            )}
        </div>
    );

    const renderProfile = () => (
        <div className="profile-view max-w-2xl mx-auto">
            <div className="page-header">
                <h1 className="page-title">My Profile</h1>
                {!isProfileEdit && <Button onClick={() => setProfileEdit(true)}>Edit Profile</Button>}
            </div>

            <Card className="p-6">
                {isProfileEdit ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                        <div className="form-group">
                            <label className="form-label">First Name</label>
                            <input className="form-input" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Last Name</label>
                            <input className="form-input" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input className="form-input" type="text" value={email} readOnly disabled />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Age</label>
                            <input className="form-input" type="number" value={age} onChange={(e) => setAge(e.target.value)} min="0" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Interests</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    className="form-input"
                                    type="text"
                                    value={newInterest}
                                    onChange={(e) => setNewInterest(e.target.value)}
                                    placeholder="Add interest"
                                    onKeyDown={(e) => e.key === 'Enter' && addInterest(e)}
                                />
                                <Button onClick={addInterest} type="button">Add</Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {interests.map((interest, index) => (
                                    <span key={index} className="bg-muted px-2 py-1 rounded text-sm flex items-center gap-1">
                                        {interest}
                                        <button type="button" onClick={() => removeInterest(index)} className="text-muted-foreground hover:text-foreground">&times;</button>
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-4 mt-6">
                            <Button type="submit">Save Changes</Button>
                            <Button variant="secondary" type="button" onClick={handleCancel}>Cancel</Button>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm text-muted-foreground">First Name</label>
                                <p className="font-medium">{firstName || '—'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground">Last Name</label>
                                <p className="font-medium">{lastName || '—'}</p>
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground">Email</label>
                                <p className="font-medium">{email}</p>
                            </div>
                            <div>
                                <label className="text-sm text-muted-foreground">Age</label>
                                <p className="font-medium">{age || '—'}</p>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm text-muted-foreground block mb-2">Interests</label>
                            <div className="flex flex-wrap gap-2">
                                {interests.length > 0 ? interests.map((interest, index) => (
                                    <span key={index} className="bg-muted px-2 py-1 rounded text-sm">{interest}</span>
                                )) : <span className="text-muted-foreground italic">No interests added</span>}
                            </div>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );

    const renderGroupDetails = () => {
        if (!selectedGroup) return null;
        return (
            <div className="group-details-view">
                <div className="mb-6">
                    <Button variant="ghost" onClick={() => setSelectedGroup(null)} className="mb-4">← Back to Groups</Button>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="page-title mb-2">{selectedGroup.name}</h1>
                            <div className="flex items-center gap-4 text-muted-foreground">
                                <span>{selectedGroup.members?.length || 0} Members</span>
                                <div className="flex items-center gap-2">
                                    <span>Code:</span>
                                    <code className="bg-muted px-2 py-1 rounded font-mono text-sm">
                                        {visibleAccessCodes.has(selectedGroup.id) ? selectedGroup.accessCode : '••••••'}
                                    </code>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleAccessCode(selectedGroup.id)}
                                    >
                                        {visibleAccessCodes.has(selectedGroup.id) ? 'Hide' : 'Show'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={() => {
                                resetEventForm();
                                setIsEditingEvent(false);
                                setEditingEventId(null);
                                setEventGroupId(selectedGroup.id);
                                setShowEventModal(true);
                                setMode('event');
                            }}>Create Event</Button>
                            <Button variant="danger" onClick={() => leaveGroup(selectedGroup.id)}>Leave Group</Button>
                        </div>
                    </div>
                </div>

                <h2 className="text-xl font-semibold mb-4">Events</h2>
                {(!selectedGroup.events || selectedGroup.events.length === 0) ? (
                    <div className="empty-state py-8">
                        <p className="text-muted-foreground">No events planned yet.</p>
                    </div>
                ) : (
                    <div className="card-grid">
                        {selectedGroup.events.map(event => (
                            <EventCard
                                key={event.id}
                                event={event}
                                onClick={() => {
                                    const isParticipant = Array.isArray(event.participants) && auth.currentUser && event.participants.includes(auth.currentUser.uid);
                                    if (isParticipant) {
                                        setEditingEventId(event.id);
                                        setEventGroupId(selectedGroup.id);
                                        setMode('view'); // New mode 'view'
                                        setShowEventDrawer(true); // Open drawer instead of modal
                                    } else {
                                        setSelectedEventForJoin(event);
                                        setShowJoinConfirmationModal(true);
                                    }
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Helper to render event details inside the modal when mode === 'view'
    const renderEventDetailsModalContent = () => {
        if (!selectedGroup || !editingEventId) return null;
        const event = selectedGroup.events.find(e => e.id === editingEventId);
        if (!event) return null;

        const isParticipant = Array.isArray(event.participants) && auth.currentUser && event.participants.includes(auth.currentUser.uid);
        const amCreator = auth.currentUser && event.createdBy === auth.currentUser.uid;

        // Calculate minimum budget
        let minBudget = event.budget || Infinity;
        if (event.preferences) {
            Object.values(event.preferences).forEach(pref => {
                if (pref.budget && !isNaN(pref.budget)) {
                    minBudget = Math.min(minBudget, Number(pref.budget));
                }
            });
        }
        const displayBudget = minBudget === Infinity ? '—' : `$${minBudget}`;

        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="text-sm text-muted-foreground">Date</label>
                        <p className="font-medium">{event.date ? new Date(event.date).toLocaleString() : '—'}</p>
                    </div>
                    <div>
                        <label className="text-sm text-muted-foreground">Location</label>
                        <p className="font-medium">{event.location || '—'}</p>
                    </div>
                    <div>
                        <label className="text-sm text-muted-foreground">Budget (Lowest)</label>
                        <p className="font-medium">{displayBudget}</p>
                    </div>
                </div>

                <div>
                    <h3 className="font-semibold mb-2">Preferences</h3>
                    <div className="bg-muted p-3 rounded-md space-y-2 text-sm">
                        {event.preferences && Object.keys(event.preferences).length > 0 ? (
                            Object.entries(event.preferences).map(([uid, p]) => (
                                <div key={uid}>
                                    <span className="font-semibold">{nameOf(uid)}:</span>{' '}
                                    <span>budget: {p?.budget ?? '—'}</span>{' '}
                                    <span>• vibes: {Array.isArray(p?.vibes) && p.vibes.length ? p.vibes.join(', ') : '—'}</span>
                                </div>
                            ))
                        ) : (
                            <em className="text-muted-foreground">No preferences yet</em>
                        )}
                    </div>
                </div>

                {/* AI & Voting */}
                {(event.aiResult?.text || llmBusy.has(event.id)) && (
                    <div className="border-t pt-4">
                        {llmBusy.has(event.id) ? (
                            <AILoading />
                        ) : (
                            <ActivitiesViewer
                                rawLLMtext={event.aiResult.text}
                                voting={event.voting}
                                isParticipant={isParticipant}
                                currentUserId={auth.currentUser?.uid}
                                onVote={(activityIndex) => castVote(selectedGroup.id, event.id, activityIndex)}
                            />
                        )}

                        <div className="flex gap-2 mt-4 flex-wrap">
                            {amCreator && !event.voting?.isOpen && !event.voting?.winner && (
                                <Button onClick={() => startVoting(selectedGroup.id, event.id)} className="bg-green-600 hover:bg-green-700 text-white">
                                    🗳️ Start Voting
                                </Button>
                            )}
                            {amCreator && event.voting?.winner && (
                                <Button onClick={() => resetVoting(selectedGroup.id, event.id)} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                                    🔄 Reset Voting
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex gap-2 flex-wrap border-t pt-4">
                    {!isParticipant ? (
                        <Button onClick={() => joinEvent(selectedGroup.id, event.id)}>Join Event</Button>
                    ) : null}

                    {/* Edit Event Button - Only for Creator */}
                    {event.createdBy === auth.currentUser?.uid && (
                        <Button variant="outline" onClick={() => {
                            setEventForm({
                                name: event.name,
                                location: event.location,
                                date: event.date || "",
                                budget: "", // Budget handled in preferences
                                vibes: [],
                                interests: Array.isArray(interests) ? interests : [],
                            });
                            setIsEditingEvent(true);
                            setShowEventDrawer(false); // Close drawer
                            setShowEventModal(true); // Open modal
                            setMode(null);
                        }}>Edit Event</Button>
                    )}

                    {/* Edit Preferences Button - Only for Participants */}
                    {isParticipant && (
                        <Button
                            variant="primary" // Changed from secondary to primary
                            onClick={() => {
                                const my = (event.preferences && event.preferences[auth.currentUser?.uid]) || {};
                                // Use stored interests if available, otherwise fall back to profile interests
                                const currentInterests = my.interests && my.interests.length > 0 ? my.interests : (Array.isArray(interests) ? interests : []);

                                setEventForm({
                                    name: event.name,
                                    location: event.location,
                                    date: event.date || "", // Keep date context
                                    budget: my.budget || "",
                                    vibes: my.vibes || [],
                                    interests: currentInterests
                                });
                                setVibeDraft("");
                                setMode('myPref');
                                setShowEventDrawer(false); // Close drawer
                                setShowEventModal(true); // Open modal for preferences
                            }}
                            disabled={event.voting?.isOpen || event.voting?.winner}
                        >
                            Edit My Preference
                        </Button>
                    )}

                    {event.createdBy === auth.currentUser?.uid && (
                        <Button variant="danger" onClick={() => deleteEvent(selectedGroup.id, event.id)}>Delete Event</Button>
                    )}

                    {/* Leave Event Button for non-creators */}
                    {event.createdBy !== auth.currentUser?.uid && (
                        <Button variant="danger" onClick={() => leaveEvent(selectedGroup.id, event.id)}>Leave Event</Button>
                    )}

                    {event.createdBy === auth.currentUser?.uid && (
                        <Button
                            onClick={() => generateForEvent(selectedGroup.id, event.id)}
                            disabled={llmBusy.has(event.id) || event.voting?.isOpen || event.voting?.winner}
                        >
                            {llmBusy.has(event.id) ? 'Generating…' : 'Generate Ideas'}
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="dashboard-container">
            {/* Toast */}
            {toast.visible && (
                <div style={{
                    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
                    background: toast.type === 'success' ? 'var(--success)' : (toast.type === 'error' ? 'var(--destructive)' : 'var(--foreground)'),
                    color: 'white', padding: '0.75rem 1.5rem', borderRadius: 'var(--radius)',
                    boxShadow: 'var(--shadow-lg)', zIndex: 2000, fontWeight: 500
                }}>{toast.message}</div>
            )}

            {!isLoggedIn ? (
                <div className="flex items-center justify-center min-h-screen w-full bg-background p-4">
                    {renderLogin()}
                </div>
            ) : (
                <>
                    <button className="mobile-menu-btn" onClick={() => setIsSidebarOpen(true)}>
                        <span style={{ fontSize: '1.5rem' }}>☰</span>
                    </button>
                    {renderSidebar()}
                    <div className="main-content">
                        <div className="top-bar">
                            <div className="flex items-center gap-3 mr-4">
                                <div className="text-right hidden sm:block">
                                    <div className="font-medium text-sm">{firstName} {lastName}</div>
                                    <div className="text-xs text-muted-foreground">{email}</div>
                                </div>
                            </div>
                            <Button variant="ghost" onClick={toggleTheme} className="mr-2">
                                {theme === 'light' ? '🌙' : '☀️'}
                            </Button>
                            <Button variant="danger" onClick={handleLogout}>Sign Out</Button>
                        </div>
                        {selectedGroup ? renderGroupDetails() : (
                            activeTab === 'groups' ? renderGroups() : renderProfile()
                        )}
                    </div>
                </>
            )}

            {/* Modals */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Create New Group"
            >
                <div className="space-y-4">
                    <div className="form-group">
                        <label className="form-label">Group Name</label>
                        <input
                            className="form-input"
                            type="text"
                            value={newGroupName}
                            onChange={(e) => setNewGroupName(e.target.value)}
                            placeholder="e.g. Weekend Hikers"
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                        <Button onClick={createGroup} disabled={!newGroupName.trim()}>Create</Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showJoinModal}
                onClose={() => setShowJoinModal(false)}
                title="Join Group"
            >
                <div className="space-y-4">
                    <div className="form-group">
                        <label className="form-label">Access Code</label>
                        <input
                            className="form-input"
                            type="text"
                            value={joinAccessCode}
                            onChange={(e) => setJoinAccessCode(e.target.value)}
                            placeholder="e.g. X7Y2Z9"
                            onKeyPress={(e) => e.key === 'Enter' && joinGroup()}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowJoinModal(false)}>Cancel</Button>
                        <Button onClick={() => joinGroup()} disabled={!joinAccessCode.trim()}>Join</Button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showJoinConfirmationModal}
                onClose={() => setShowJoinConfirmationModal(false)}
                title="Join Event?"
            >
                <div className="space-y-4">
                    <p>Would you like to join <strong>{selectedEventForJoin?.name}</strong>?</p>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowJoinConfirmationModal(false)}>No</Button>
                        <Button onClick={joinEventAndEditPrefs}>Yes, Join</Button>
                    </div>
                </div>
            </Modal>

            {/* Create/Edit Event Modal */}
            <Modal
                isOpen={showEventModal}
                onClose={() => setShowEventModal(false)}
                title={mode === 'myPref' ? 'Edit My Preferences' : (isEditingEvent ? 'Edit Event' : 'Create Event')}
            >
                <div className="space-y-4">
                    {mode === 'myPref' ? (
                        <>
                            <div className="form-group">
                                <label className="form-label">Budget</label>
                                <input
                                    className="form-input"
                                    type="number"
                                    value={eventForm.budget}
                                    onChange={(e) => setEventForm(prev => ({ ...prev, budget: e.target.value }))}
                                    min="0"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Your Interests (from Profile)</label>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {eventForm.interests && eventForm.interests.length > 0 ? (
                                        eventForm.interests.map((interest, i) => (
                                            <span key={i} className="bg-muted px-2 py-1 rounded text-sm text-muted-foreground">
                                                {interest}
                                            </span>
                                        ))
                                    ) : (
                                        <span className="text-muted-foreground text-sm">No interests in profile</span>
                                    )}
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Event Vibes</label>
                                <div className="flex gap-2 mb-2">
                                    <input
                                        className="form-input"
                                        type="text"
                                        value={vibeDraft}
                                        onChange={(e) => setVibeDraft(e.target.value)}
                                        placeholder="e.g. chill"
                                        onKeyDown={(e) => e.key === 'Enter' && addVibe(e)}
                                    />
                                    <Button type="button" onClick={addVibe}>Add</Button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(eventForm.vibes || []).map((v, i) => (
                                        <span key={i} className="bg-muted px-2 py-1 rounded text-sm flex items-center gap-1">
                                            {v}
                                            <button type="button" onClick={() => removeVibe(i)} className="text-muted-foreground hover:text-foreground">&times;</button>
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-group">
                                <label className="form-label">Name</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={eventForm.name}
                                    onChange={(e) => setEventForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="e.g. Weekend Hike"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Location</label>
                                <input
                                    className="form-input"
                                    type="text"
                                    value={eventForm.location}
                                    onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                                    placeholder="e.g. Blue Hills"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date</label>
                                <input
                                    className="form-input"
                                    type="datetime-local"
                                    value={eventForm.date}
                                    onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                                />
                            </div>
                        </>
                    )}

                    <div className="flex justify-end gap-2 mt-6">
                        <Button variant="ghost" onClick={() => setShowEventModal(false)}>Cancel</Button>
                        <Button
                            variant="primary"
                            onClick={() => {
                                if (mode === 'myPref') {
                                    updateMyEventPreference(eventGroupId, editingEventId, eventForm.budget, eventForm.vibes);
                                } else if (isEditingEvent) {
                                    updateEvent(eventGroupId, editingEventId);
                                } else {
                                    // Create event flow
                                    (async () => {
                                        const newId = await addEvent(selectedGroup.id);
                                        if (newId) {
                                            setEditingEventId(newId);
                                            setEventGroupId(selectedGroup.id);
                                            setMode('myPref');
                                            setEventForm(prev => ({ ...prev, budget: "", vibes: [] }));
                                            setVibeDraft("");
                                        }
                                    })();
                                }
                            }}
                            disabled={mode !== 'myPref' && (!eventForm.name.trim() || !selectedGroup?.id)}
                        >
                            {mode === 'myPref' ? 'Save Preferences' : (isEditingEvent ? 'Save Changes' : 'Create Event')}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Event Details Side Drawer */}
            <SideDrawer
                isOpen={showEventDrawer}
                onClose={() => setShowEventDrawer(false)}
                title={selectedGroup?.events.find(e => e.id === editingEventId)?.name || 'Event Details'}
            >
                {renderEventDetailsModalContent()}
            </SideDrawer>
        </div >
    );
}

export default SinglePage;