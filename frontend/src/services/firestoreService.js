// frontend/src/services/firestoreService.js
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

// ==================== USER PROFILE OPERATIONS ====================

/**
 * Create or update user profile after authentication
 * Call this after user signs up with Firebase Auth
 */
export const createUserProfile = async (userId, profileData) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      email: profileData.email,
      name: profileData.name || '',
      age: profileData.age || null,
      gender: profileData.gender || '',
      interests: profileData.interests || [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('✅ User profile created:', userId);
    return { success: true, userId };
  } catch (error) {
    console.error('❌ Error creating user profile:', error);
    throw error;
  }
};

/**
 * Get user profile by ID
 */
export const getUserProfile = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return { 
        success: true, 
        data: { id: userSnap.id, ...userSnap.data() } 
      };
    } else {
      return { success: false, message: 'User not found' };
    }
  } catch (error) {
    console.error('❌ Error getting user profile:', error);
    throw error;
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId, updates) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ User profile updated:', userId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    throw error;
  }
};

// ==================== GROUP OPERATIONS ====================

/**
 * Generate a unique 6-character group code
 */
const generateGroupCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

/**
 * Check if a group code already exists
 */
const isGroupCodeUnique = async (code) => {
  const groupsRef = collection(db, 'groups');
  const q = query(groupsRef, where('code', '==', code));
  const querySnapshot = await getDocs(q);
  return querySnapshot.empty;
};

/**
 * Create a new group
 */
export const createGroup = async (creatorId, groupName) => {
  try {
    let groupCode = generateGroupCode();
    
    // Ensure code is unique (keep trying if collision)
    let isUnique = await isGroupCodeUnique(groupCode);
    while (!isUnique) {
      groupCode = generateGroupCode();
      isUnique = await isGroupCodeUnique(groupCode);
    }
    
    const groupRef = await addDoc(collection(db, 'groups'), {
      name: groupName,
      code: groupCode,
      creatorId: creatorId,
      members: [creatorId],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Group created:', groupRef.id, 'Code:', groupCode);
    return { 
      success: true, 
      groupId: groupRef.id, 
      code: groupCode 
    };
  } catch (error) {
    console.error('❌ Error creating group:', error);
    throw error;
  }
};

/**
 * Get group by access code
 */
export const getGroupByCode = async (code) => {
  try {
    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, where('code', '==', code.toUpperCase()));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const groupDoc = querySnapshot.docs[0];
      return { 
        success: true, 
        data: { id: groupDoc.id, ...groupDoc.data() } 
      };
    } else {
      return { success: false, message: 'Group not found' };
    }
  } catch (error) {
    console.error('❌ Error getting group by code:', error);
    throw error;
  }
};

/**
 * Get group by ID
 */
export const getGroup = async (groupId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    
    if (groupSnap.exists()) {
      return { 
        success: true, 
        data: { id: groupSnap.id, ...groupSnap.data() } 
      };
    } else {
      return { success: false, message: 'Group not found' };
    }
  } catch (error) {
    console.error('❌ Error getting group:', error);
    throw error;
  }
};

/**
 * Join a group using access code
 */
export const joinGroup = async (userId, groupCode) => {
  try {
    const groupResult = await getGroupByCode(groupCode);
    
    if (!groupResult.success) {
      return { success: false, message: 'Invalid group code' };
    }
    
    const groupId = groupResult.data.id;
    const groupRef = doc(db, 'groups', groupId);
    
    // Check if user is already a member
    if (groupResult.data.members.includes(userId)) {
      return { success: false, message: 'Already a member of this group' };
    }
    
    await updateDoc(groupRef, {
      members: arrayUnion(userId),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ User joined group:', userId, groupId);
    return { success: true, groupId, groupData: groupResult.data };
  } catch (error) {
    console.error('❌ Error joining group:', error);
    throw error;
  }
};

/**
 * Get all groups for a user
 */
export const getUserGroups = async (userId) => {
  try {
    const groupsRef = collection(db, 'groups');
    const q = query(groupsRef, where('members', 'array-contains', userId));
    const querySnapshot = await getDocs(q);
    
    const groups = [];
    querySnapshot.forEach((doc) => {
      groups.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`✅ Found ${groups.length} groups for user:`, userId);
    return { success: true, data: groups };
  } catch (error) {
    console.error('❌ Error getting user groups:', error);
    throw error;
  }
};

/**
 * Get all members of a group with their profile info
 */
export const getGroupMembers = async (groupId) => {
  try {
    const groupResult = await getGroup(groupId);
    if (!groupResult.success) {
      return { success: false, message: 'Group not found' };
    }
    
    const memberIds = groupResult.data.members;
    const members = [];
    
    for (const memberId of memberIds) {
      const userResult = await getUserProfile(memberId);
      if (userResult.success) {
        members.push(userResult.data);
      }
    }
    
    return { success: true, data: members };
  } catch (error) {
    console.error('❌ Error getting group members:', error);
    throw error;
  }
};

/**
 * Leave a group
 */
export const leaveGroup = async (userId, groupId) => {
  try {
    const groupRef = doc(db, 'groups', groupId);
    await updateDoc(groupRef, {
      members: arrayRemove(userId),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ User left group:', userId, groupId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error leaving group:', error);
    throw error;
  }
};

/**
 * Delete a group (only creator can do this)
 */
export const deleteGroup = async (groupId, userId) => {
  try {
    const groupResult = await getGroup(groupId);
    
    if (!groupResult.success) {
      return { success: false, message: 'Group not found' };
    }
    
    if (groupResult.data.creatorId !== userId) {
      return { success: false, message: 'Only the creator can delete this group' };
    }
    
    await deleteDoc(doc(db, 'groups', groupId));
    console.log('✅ Group deleted:', groupId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting group:', error);
    throw error;
  }
};

// ==================== EVENT OPERATIONS ====================

/**
 * Create an event in a group
 */
export const createEvent = async (groupId, eventData) => {
  try {
    const eventRef = await addDoc(collection(db, 'events'), {
      groupId: groupId,
      location: eventData.location,
      budget: eventData.budget,
      date: eventData.date || null,
      memberVibes: eventData.memberVibes || {}, // { userId: 'vibe' }
      status: 'pending', // pending, confirmed, completed, cancelled
      suggestedActivity: null,
      itinerary: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Event created:', eventRef.id);
    return { success: true, eventId: eventRef.id };
  } catch (error) {
    console.error('❌ Error creating event:', error);
    throw error;
  }
};

/**
 * Get event by ID
 */
export const getEvent = async (eventId) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    const eventSnap = await getDoc(eventRef);
    
    if (eventSnap.exists()) {
      return { 
        success: true, 
        data: { id: eventSnap.id, ...eventSnap.data() } 
      };
    } else {
      return { success: false, message: 'Event not found' };
    }
  } catch (error) {
    console.error('❌ Error getting event:', error);
    throw error;
  }
};

/**
 * Get all events for a group
 */
export const getGroupEvents = async (groupId) => {
  try {
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, where('groupId', '==', groupId));
    const querySnapshot = await getDocs(q);
    
    const events = [];
    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`✅ Found ${events.length} events for group:`, groupId);
    return { success: true, data: events };
  } catch (error) {
    console.error('❌ Error getting group events:', error);
    throw error;
  }
};

/**
 * Update member vibe for an event
 */
export const updateMemberVibe = async (eventId, userId, vibe) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      [`memberVibes.${userId}`]: vibe,
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Member vibe updated:', eventId, userId, vibe);
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating member vibe:', error);
    throw error;
  }
};

/**
 * Update event with activity suggestion from LLM
 */
export const updateEventWithActivity = async (eventId, activityData) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      suggestedActivity: activityData.activity,
      itinerary: activityData.itinerary || null,
      status: 'confirmed',
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Event updated with activity:', eventId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating event with activity:', error);
    throw error;
  }
};

/**
 * Update event status
 */
export const updateEventStatus = async (eventId, status) => {
  try {
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, {
      status: status, // pending, confirmed, completed, cancelled
      updatedAt: serverTimestamp()
    });
    
    console.log('✅ Event status updated:', eventId, status);
    return { success: true };
  } catch (error) {
    console.error('❌ Error updating event status:', error);
    throw error;
  }
};

/**
 * Delete an event
 */
export const deleteEvent = async (eventId) => {
  try {
    await deleteDoc(doc(db, 'events', eventId));
    console.log('✅ Event deleted:', eventId);
    return { success: true };
  } catch (error) {
    console.error('❌ Error deleting event:', error);
    throw error;
  }
};