import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, writeBatch, addDoc, updateDoc, getDoc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC6wkHeUtbYdlYeZZA_4RDbjes7MuP-i4E",
    authDomain: "availability-793c7.firebaseapp.com",
    projectId: "availability-793c7",
    storageBucket: "availability-793c7.firebasestorage.app",
    messagingSenderId: "633994803232",
    appId: "1:633994803232:web:9e91d4d4fefd928ef26445",
    measurementId: "G-6QR4CTJCXD"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);
const ADMIN_EMAIL = "sofia.l.borch@gmail.com"; 

// Export to window for legacy access in other files
window.db = db;
window.auth = auth;
window.dbFormat = { collection, getDocs, doc, setDoc, deleteDoc, writeBatch, addDoc, updateDoc, getDoc, query, where, onSnapshot };

function toggleAuthModal() {
    const modal = document.getElementById('auth-modal');
    modal.classList.toggle('hidden');
    document.getElementById('auth-error').classList.add('hidden');
}

async function loginGoogle() {
    const errorMsg = document.getElementById('auth-error');
    errorMsg.classList.add('hidden');
    try {
        await signInWithPopup(auth, provider);
        toggleAuthModal();
    } catch (error) {
        console.error("Login Error:", error);
        errorMsg.textContent = "Auth Failed: " + error.message;
        errorMsg.classList.remove('hidden');
    }
}

async function signOutUser() {
    try {
        await signOut(auth);
        toggleAuthModal();
    } catch(e) { console.error(e); }
}

// Global Auth State Listener
onAuthStateChanged(auth, (user) => {
    const adminTools = document.getElementById('admin-tools');
    const authIcon = document.getElementById('auth-icon');
    const authAvatar = document.getElementById('auth-avatar');
    const viewGuest = document.getElementById('auth-view-guest');
    const viewUser = document.getElementById('auth-view-user');
    const userEmailDisplay = document.getElementById('user-email-display');
    const profilePicLarge = document.getElementById('profile-pic-large');
    const adminBadge = document.getElementById('admin-badge');
    
    if (!user) {
        signInAnonymously(auth).catch((error) => console.error("Anonymous auth failed", error));
        adminTools.classList.add('hidden');
        window.isAdmin = false;
        
        authIcon.classList.remove('hidden');
        authAvatar.classList.add('hidden');
        viewGuest.classList.remove('hidden');
        viewUser.classList.add('hidden');
    } else {
        const isAnon = user.isAnonymous;
        const isMe = user.email === ADMIN_EMAIL;
        
        window.isAdmin = isMe;
        if(isMe) {
            adminTools.classList.remove('hidden'); 
            if(window.subscribeToInbox) window.subscribeToInbox();
        } else {
            adminTools.classList.add('hidden');
        }
        
        if (!isAnon && window.requests && window.requests.subscribeToMyRequests) {
            window.requests.subscribeToMyRequests(user);
        }

        if (isAnon) {
            authIcon.classList.remove('hidden');
            authAvatar.classList.add('hidden');
            viewGuest.classList.remove('hidden');
            viewUser.classList.add('hidden');
        } else {
            authIcon.classList.add('hidden');
            authAvatar.classList.remove('hidden');
            authAvatar.src = user.photoURL || 'https://ui-avatars.com/api/?name=' + user.displayName;
            
            viewGuest.classList.add('hidden');
            viewUser.classList.remove('hidden');
            userEmailDisplay.innerText = user.email;
            profilePicLarge.src = user.photoURL || 'https://ui-avatars.com/api/?name=' + user.displayName;
            
            if(isMe) adminBadge.classList.remove('hidden');
            else adminBadge.classList.add('hidden');
        }
    }
    
    // Trigger App Init only after Auth is settled/known
    if(window.initApp) window.initApp();
});

// Export Auth Module Functions
window.authModule = {
    toggleAuthModal,
    loginGoogle,
    signOutUser
};

// Keyboard Shortcut for Auth
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        toggleAuthModal();
    }
});