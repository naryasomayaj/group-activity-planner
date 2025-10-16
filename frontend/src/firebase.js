// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";



// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBiDp9AmKusNqjnNyWDLyIQKuG_yCEprmk",
  authDomain: "groupactivityplanner-24ae4.firebaseapp.com",
  projectId: "groupactivityplanner-24ae4",
  storageBucket: "groupactivityplanner-24ae4.firebasestorage.app",
  messagingSenderId: "29872697915",
  appId: "1:29872697915:web:d602e96b9a34222600221e",
  measurementId: "G-KPDJ0GXJP4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


export {auth, app, db} // export auth, app, and db so we can use these in other files