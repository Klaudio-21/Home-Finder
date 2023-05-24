// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCGvxdEQOrpMmhN_pYN4cPuqPpMO87ucgc",
  authDomain: "house-marketing-app-2c961.firebaseapp.com",
  projectId: "house-marketing-app-2c961",
  storageBucket: "house-marketing-app-2c961.appspot.com",
  messagingSenderId: "173073726138",
  appId: "1:173073726138:web:ebcd121a53439c72fca083",
};

// Initialize Firebase
initializeApp(firebaseConfig);

export const db = getFirestore();
