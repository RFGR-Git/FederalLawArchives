import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';

// Your Firebase Configuration (replace with your actual values from Firebase Console)
// IMPORTANT: For a production app, you would typically use environment variables
// to store sensitive keys like apiKey, not hardcode them directly.
const firebaseConfig = {
  apiKey: "AIzaSyCE-33rHyfhax9PSphsr7ugtfG9xyu-Xn4", // Replace with your actual API Key
  authDomain: "russianlawsarchive.firebaseapp.com", // Replace with your actual auth domain
  projectId: "russianlawsarchive", // Replace with your actual project ID
  storageBucket: "russianlawsarchive.firebasestorage.app", // Replace with your actual storage bucket
  messagingSenderId: "1076831524775", // Replace with your actual sender ID
  appId: "1:1076831524775:web:bd11e608a02c78c56ac882", // Replace with your actual app ID
  measurementId: "G-T6HLBXNX7S" // Optional, if you enabled Analytics
};

// Initialize Firebase outside the component to prevent re-initialization
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Mock data for titles/categories structure (these are static categories, not from Firestore)
const staticLegalTitles = [
    { id: 'constitution', name: 'Title 1: Constitution & Founding Acts', icon: 'scale' },
    { id: 'criminal-law', name: 'Title 2: Criminal Law', icon: 'gavel' },
    { id: 'civil-commercial', name: 'Title 3: Civil & Commercial Law', icon: 'landmark' },
    { id: 'labor-law', name: 'Title 4: Labour Law', icon: 'briefcase' },
    { id: 'taxation', name: 'Title 5: Taxation', icon: 'wallet' },
    { id: 'national-security', name: 'Title 6: National Security', icon: 'shield' },
    { id: 'health-education', name: 'Title 7: Health & Education', icon: 'heart' },
    { id: 'public-order', name: 'Title 8: Public Order & Internal Affairs', icon: 'megaphone' },
    // You can add more static categories here if needed
];

// Main App Component
function App() {
    const [currentPage, setCurrentPage] = useState('home');
    const [selectedLaw, setSelectedLaw] = useState(null);
    const [searchKeyword, setSearchKeyword] = useState('');
    const [searchLawNumber, setSearchLawNumber] = useState('');
    const [searchYear, setSearchYear] = useState('');
    const [searchMinistry, setSearchMinistry] = useState('');
    const [searchTitleCategory, setSearchTitleCategory] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [adminMessage, setAdminMessage] = useState('');
    const [darkMode, setDarkMode] = useState(false);
    const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
    const [isSideNavOpen, setIsSideNavOpen] = useState(false);
    const [selectedTitleForList, setSelectedTitleForList] = useState(null);

    // State to hold laws fetched from Firestore
    const [laws, setLaws] = useState([]);
    const [isAuthReady, setIsAuthReady] = useState(false); // To track Firebase auth state
    const [firebaseUser, setFirebaseUser] = useState(null); // To store the actual Firebase user object

    // Firebase Auth and Firestore Listener
    useEffect(() => {
        // Anonymous Authentication for general users
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("Firebase User ID:", user.uid);
                setFirebaseUser(user); // Set the user object
                setIsAuthReady(true);
            } else {
                console.log("No user signed in, attempting anonymous sign-in...");
                signInAnonymously(auth)
                    .then((credential) => {
                        console.log("Signed in anonymously:", credential.user.uid);
                        setFirebaseUser(credential.user); // Set the anonymous user
                        setIsAuthReady(true);
                    })
                    .catch((error) => {
                        console.error("Error signing in anonymously:", error);
                        setAdminMessage(`Authentication error: ${error.message}`);
                        setIsAuthReady(true); // Still set ready even on error, but user will be null
                    });
            }
        });

        // Firestore data listener for the 'laws' collection
        const lawsCollectionRef = collection(db, "laws"); // Using "laws" as the collection name

        const unsubscribeFirestore = onSnapshot(lawsCollectionRef, (snapshot) => {
            const fetchedLaws = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setLaws(fetchedLaws);
            console.log("Laws fetched from Firestore:", fetchedLaws);
        }, (error) => {
            console.error("Error fetching laws from Firestore:", error);
            setAdminMessage(`Error fetching laws: ${error.message}`);
        });

        // Cleanup function for both listeners
        return () => {
            unsubscribeAuth();
            unsubscribeFirestore();
        };
    }, []); // Empty dependency array means this runs once on mount

    // Derived data from fetched laws
    const allLegalItems = laws; // 'laws' state is already the flattened list from Firestore
    const allMinistries = [...new Set(allLegalItems.map(item => item.ministry).filter(Boolean))].sort();
    const allYears = [...new Set(allLegalItems.map(item => item.year).filter(Boolean))].sort((a, b) => b - a);

    // Handle navigation
    const navigateTo = useCallback((page, data = null) => {
        setCurrentPage(page);
        setSelectedLaw(data);
        setAdminMessage('');
        setSearchKeyword('');
        setSearchLawNumber('');
        setSearchYear('');
        setSearchMinistry('');
        setSearchResults([]);
        setIsSideNavOpen(false);
        if (page === 'law-list-by-title') {
            setSelectedTitleForList(data);
        } else {
            setSelectedTitleForList(null);
        }
    }, []);

    // Perform search function
    const performSearch = useCallback(() => {
        const keywordLower = searchKeyword.toLowerCase();
        const lawNumberLower = searchLawNumber.toLowerCase();
        const results = allLegalItems.filter(item => {
            const matchesKeyword = !keywordLower ||
                                   item.name.toLowerCase().includes(keywordLower) ||
                                   (item.text && item.text.toLowerCase().includes(keywordLower)) ||
                                   (item.ministry && item.ministry.toLowerCase().includes(keywordLower)) ||
                                   (item.titleCategory && item.titleCategory.toLowerCase().includes(keywordLower));

            const matchesLawNumber = !lawNumberLower || (item.number && item.number.toLowerCase().includes(lawNumberLower));
            const matchesYear = !searchYear || item.year === parseInt(searchYear);
            const matchesMinistry = !searchMinistry || item.ministry === searchMinistry;
            const matchesTitleCategory = !searchTitleCategory || item.titleCategory === searchTitleCategory;

            return matchesKeyword && matchesLawNumber && matchesYear && matchesMinistry && matchesTitleCategory;
        });
        setSearchResults(results);
    }, [searchKeyword, searchLawNumber, searchYear, searchMinistry, searchTitleCategory, allLegalItems]);

    const handleAdminLogin = (username, password) => {
        // !!! IMPORTANT: This is a SIMULATED admin login for demo purposes.
        // For a real application, you MUST implement Firebase Authentication
        // (e.g., Email/Password, Google Sign-In) here for security.
        if (username === 'admin' && password === 'password123') {
            setIsAdminLoggedIn(true);
            setAdminMessage('Login successful! (Simulated)');
            return true;
        } else {
            setAdminMessage('Invalid username or password.');
            return false;
        }
    };

    const handleAdminLogout = () => {
        setIsAdminLoggedIn(false);
        setAdminMessage('Logged out.');
        navigateTo('home');
    };

    // Firebase Admin Actions - Add/Edit/Delete
    const handleManageLaw = async (lawData, actionType) => {
        if (!firebaseUser) { // Use firebaseUser state for check
            setAdminMessage("Error: You must be authenticated to perform this action. Please wait for authentication to complete.");
            return;
        }

        const lawsCollectionRef = collection(db, "laws"); // Target the 'laws' collection

        try {
            if (actionType === 'add') {
                const docRef = await addDoc(lawsCollectionRef, lawData);
                setAdminMessage(`Law "${lawData.name}" added successfully with ID: ${docRef.id}`);
            } else if (actionType === 'edit') {
                const { id, ...dataToUpdate } = lawData; // Separate id from data
                await setDoc(doc(lawsCollectionRef, id), dataToUpdate, { merge: true }); // Use setDoc with merge for update
                setAdminMessage(`Law "${lawData.name}" updated successfully.`);
            } else if (actionType === 'delete') {
                await deleteDoc(doc(lawsCollectionRef, lawData.id));
                setAdminMessage(`Law "${lawData.name}" deleted successfully.`);
            }
        } catch (error) {
            console.error(`Error ${actionType}ing law:`, error);
            setAdminMessage(`Error ${actionType}ing law: ${error.message}. Please ensure your Firebase security rules allow write access for authenticated users.`);
        }
    };


    // Render content based on currentPage state
    const renderContent = () => {
        // These classes are now handled by Tailwind and custom CSS in index.css
        const themeClass = darkMode ? 'dark-mode' : 'light-mode';
        const textColor = darkMode ? 'text-white' : 'text-dark-text';
        const secondaryTextColor = darkMode ? 'text-gray-400' : 'text-secondary-grey';
        const cardBg = darkMode ? 'bg-dark-card' : 'bg-white';
        const inputBg = darkMode ? 'bg-input-dark' : 'bg-white';
        const inputBorder = darkMode ? 'border-input-border-dark' : 'border-secondary-grey';
        const inputPlaceholder = darkMode ? 'placeholder-gray-500' : 'placeholder-secondary-grey';


        switch (currentPage) {
            case 'home':
                return (
                    <div className={`relative flex flex-col items-center justify-center min-h-[calc(100vh-140px)] p-6 ${themeClass}`}>
                        {/* Removed Russian Double-Headed Eagle Watermark */}

                        <h2 className={`text-5xl md:text-6xl font-pt-serif font-bold ${textColor} text-center mb-4 drop-shadow-lg animate-fade-in z-10`}>
                            A Living Record of the Law
                            <span className="inline-block ml-4 animate-waving-flag">
                                <svg className="w-12 h-12 text-accent-red" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M14.4 6L14 2H6v7.6L14.4 14 14 22h8V6h-7.6z"/>
                                </svg>
                            </span>
                        </h2>
                        <p className={`text-xl md:text-2xl font-roboto ${secondaryTextColor} text-center mb-8 animate-fade-in delay-200 z-10`}>
                            Explore the active legal framework passed by the State Duma and signed into law by the President.
                        </p>
                        <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 z-10">
                            <button
                                onClick={() => navigateTo('browse')}
                                className="btn-primary-red"
                            >
                                Browse the Laws
                            </button>
                            <button
                                onClick={() => navigateTo('about')}
                                className="btn-secondary-blue"
                            >
                                Explore Our Legal Foundations
                            </button>
                            <button
                                onClick={() => navigateTo('browse')} // Search integrated into browse
                                className="btn-secondary-blue"
                            >
                                Search by Title or Year
                            </button>
                        </div>

                        <div className="mt-16 w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6 z-10">
                            {/* Example cards, linking to actual laws if they exist */}
                            <div className={`${cardBg} p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer border ${inputBorder}`} onClick={() => navigateTo('law-page', laws.find(l => l.id === 'const-1993'))}>
                                <h3 className={`text-xl font-pt-serif font-semibold ${textColor} mb-2`}>Constitution</h3>
                                <p className={`${secondaryTextColor} text-sm`}>The fundamental law of the Russian Federation.</p>
                            </div>
                            <div className={`${cardBg} p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer border ${inputBorder}`}>
                                <h3 className={`text-xl font-pt-serif font-semibold ${textColor} mb-2`}>Most Accessed Laws</h3>
                                <p className={`${secondaryTextColor} text-sm`}>Popular and frequently viewed legal documents.</p>
                            </div>
                            <div className={`${cardBg} p-6 rounded-lg shadow-md hover:shadow-xl transition-shadow duration-300 cursor-pointer border ${inputBorder}`}>
                                <h3 className={`text-xl font-pt-serif font-semibold ${textColor} mb-2`}>Recently Updated</h3>
                                <p className={`${secondaryTextColor} text-sm`}>Stay informed on the latest legal changes.</p>
                            </div>
                        </div>
                    </div>
                );
            case 'browse':
                return (
                    <div className={`p-6 ${themeClass}`}>
                        <h2 className={`text-3xl font-pt-serif font-bold ${textColor} text-center mb-6`}>Browse Laws</h2>
                        {/* Search Bar and Filters */}
                        <div className={`${cardBg} p-6 rounded-lg shadow-lg mb-8 border ${inputBorder}`}>
                            <h3 className={`text-xl font-pt-serif font-semibold ${textColor} mb-4`}>Filter Laws</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                <input
                                    type="text"
                                    placeholder="Keyword"
                                    className={`input-field ${inputBg} ${inputBorder} ${inputPlaceholder} ${textColor}`}
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder="Law Number"
                                    className={`input-field ${inputBg} ${inputBorder} ${inputPlaceholder} ${textColor}`}
                                    value={searchLawNumber}
                                    onChange={(e) => setSearchLawNumber(e.target.value)}
                                />
                                <select
                                    className={`input-field ${inputBg} ${inputBorder} ${inputPlaceholder} ${textColor}`}
                                    value={searchYear}
                                    onChange={(e) => setSearchYear(e.target.value)}
                                >
                                    <option value="">Year Passed</option>
                                    {allYears.map(year => <option key={year} value={year}>{year}</option>)}
                                </select>
                                <select
                                    className={`input-field ${inputBg} ${inputBorder} ${inputPlaceholder} ${textColor}`}
                                    value={searchMinistry}
                                    onChange={(e) => setSearchMinistry(e.target.value)}
                                >
                                    <option value="">Sponsoring Ministry</option>
                                    {allMinistries.map(ministry => <option key={ministry} value={ministry}>{ministry}</option>)}
                                </select>
                                <select
                                    className={`input-field ${inputBg} ${inputBorder} ${inputPlaceholder} ${textColor}`}
                                    value={searchTitleCategory}
                                    onChange={(e) => setSearchTitleCategory(e.target.value)}
                                >
                                    <option value="">Title Category</option>
                                    {staticLegalTitles.map(title => <option key={title.id} value={title.name}>{title.name}</option>)}
                                    <option value="Treaties & Diplomatic Agreements">Treaties & Diplomatic Agreements</option>
                                    <option value="Court Rulings & Case Law">Court Rulings & Case Law</option>
                                </select>
                            </div>
                            <div className="flex justify-center gap-4">
                                <button onClick={performSearch} className="btn-primary">Apply Filters</button>
                                <button onClick={() => {
                                    setSearchKeyword(''); setSearchLawNumber(''); setSearchYear('');
                                    setSearchMinistry(''); setSearchTitleCategory(''); setSearchResults([]);
                                }} className="btn-secondary">Reset Filters</button>
                            </div>
                        </div>

                        {/* Display Search Results or Browse by Title */}
                        {searchResults.length > 0 ? (
                            <div className="space-y-4">
                                <h3 className={`text-2xl font-pt-serif font-bold ${textColor} mb-4`}>Search Results</h3>
                                {searchResults.map(law => (
                                    <div
                                        key={law.id}
                                        className={`${cardBg} p-4 rounded-lg shadow-md border ${inputBorder} hover:border-accent-red transition duration-200 cursor-pointer`}
                                    >
                                        <div onClick={() => navigateTo('law-page', law)}>
                                            <h4 className={`text-lg font-pt-serif font-semibold ${textColor}`}>{law.name}</h4>
                                            <p className={`${secondaryTextColor} text-sm`}>Designation: {law.number} | Status: {law.status} | Enacted: {law.date}</p>
                                        </div>
                                        {law.pdfUrl && (
                                            <a
                                                href={law.pdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-2 inline-flex items-center px-3 py-1 bg-primary-dark-blue text-white text-sm font-bold rounded-md shadow-sm hover:bg-blue-800 transition duration-200"
                                            >
                                                <svg className="lucide lucide-file-text w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
                                                View Document
                                            </a>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {staticLegalTitles.map(title => ( // Use static titles for categories
                                    <div
                                        key={title.id}
                                        className={`${cardBg} p-6 rounded-lg shadow-lg border ${inputBorder} transition duration-200 cursor-pointer transform hover:scale-105`}
                                        onClick={() => navigateTo('law-list-by-title', title)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <svg className={`lucide lucide-${title.icon} w-8 h-8 mr-3 text-primary-dark-blue`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></svg>
                                                <h3 className={`text-xl font-pt-serif font-semibold ${textColor}`}>{title.name}</h3>
                                            </div>
                                            <svg className={`lucide lucide-chevron-right w-6 h-6 ${textColor}`} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 'law-list-by-title':
                if (!selectedTitleForList) {
                    return <p className={`text-center ${textColor} py-8`}>No title selected.</p>;
                }
                // Filter laws based on the selected title category
                const lawsForSelectedTitle = laws.filter(law => law.titleCategory === selectedTitleForList.name);
                return (
                    <LawListByTitlePage title={selectedTitleForList} laws={lawsForSelectedTitle} navigateTo={navigateTo} darkMode={darkMode} />
                );
            case 'law-page':
                if (!selectedLaw) {
                    return <p className={`text-center ${textColor} py-8`}>Law details not found.</p>;
                }
                return (
                    <LawPageTemplate law={selectedLaw} onBack={() => navigateTo('law-list-by-title', selectedTitleForList)} darkMode={darkMode} />
                );
            case 'admin':
                return (
                    <div className={`p-6 ${themeClass}`}>
                        {!isAdminLoggedIn ? (
                            <AdminLoginPage onLogin={handleAdminLogin} message={adminMessage} />
                        ) : (
                            <AdminDashboard onLogout={handleAdminLogout} message={adminMessage} onManageLaw={handleManageLaw} allLaws={laws} staticLegalTitles={staticLegalTitles} isAuthReady={isAuthReady} />
                        )}
                    </div>
                );
            case 'about':
                return (
                    <div className={`p-6 ${cardBg} rounded-lg shadow-lg border ${inputBorder} ${textColor}`}>
                        <h2 className={`text-3xl font-pt-serif font-bold ${textColor} text-center mb-6`}>About the Unified Legal Code of the Russian Federation (Simulation)</h2>
                        <div className={`prose ${secondaryTextColor} max-w-none`}>
                            <p>This website serves as the official legal repository for all laws, codes, treaties, executive orders, and constitutional acts passed by the government of the Russian Federation in this Discord simulation environment.</p>
                            <p>Our purpose is to provide a comprehensive, organized, and easily searchable database of all legal documents, ensuring transparency and accessibility for all citizens and government officials within the simulation.</p>
                            <h3 className={`text-xl font-pt-serif font-semibold ${textColor} mt-6 mb-3`}>Our Mission:</h3>
                            <ul className="list-disc list-inside ml-4">
                                <li>To maintain an accurate and up-to-date record of all legislative acts.</li>
                                <li>To provide intuitive navigation and powerful search capabilities.</li>
                                <li>To foster legal literacy and engagement within the simulated government.</li>
                            </ul>
                            <h3 className={`text-xl font-pt-serif font-semibold ${textColor} mt-6 mb-3`}>Contact & Accessibility:</h3>
                            <p>For inquiries, please contact us at <a href="mailto:info@rf-laws-sim.gov" className="text-primary-dark-blue hover:underline">info@rf-laws-sim.gov</a>.</p>
                            <p>We are committed to making this archive accessible to all users. If you encounter any accessibility issues, please report them.</p>
                            <div className="mt-6 text-center">
                                <svg className="mx-auto w-20 h-20 text-gold-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                                <p className="text-xs mt-2">Unified Archive of Federal Laws</p>
                            </div>
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className={`min-h-screen ${darkMode ? 'bg-primary-dark-blue text-white' : 'bg-light-background text-dark-text'} font-inter transition-colors duration-300`}>
            {/* No more inline <style> block here */}
            {/* All CSS is now in src/index.css */}

            {/* Side Navigation Overlay */}
            <div
                className={`side-nav-overlay ${isSideNavOpen ? 'open' : ''}`}
                onClick={() => setIsSideNavOpen(false)}
            ></div>

            {/* Side Navigation */}
            <div className={`side-nav ${isSideNavOpen ? 'open' : ''}`}>
                <ul className="flex flex-col space-y-4 text-lg font-roboto p-4">
                    <li><button onClick={() => navigateTo('home')} className={`w-full text-left py-2 px-4 rounded-md hover:bg-blue-700 transition duration-150 ${currentPage === 'home' ? 'bg-blue-700 text-gold-accent font-semibold' : 'text-white'}`}>Home</button></li>
                    <li><button onClick={() => navigateTo('browse')} className={`w-full text-left py-2 px-4 rounded-md hover:bg-blue-700 transition duration-150 ${currentPage === 'browse' ? 'bg-blue-700 text-gold-accent font-semibold' : 'text-white'}`}>Browse Laws</button></li>
                    <li><button onClick={() => navigateTo('about')} className={`w-full text-left py-2 px-4 rounded-md hover:bg-blue-700 transition duration-150 ${currentPage === 'about' ? 'bg-blue-700 text-gold-accent font-semibold' : 'text-white'}`}>About</button></li>
                    <li><button onClick={() => navigateTo('admin')} className={`w-full text-left py-2 px-4 rounded-md hover:bg-blue-700 transition duration-150 ${currentPage === 'admin' ? 'bg-blue-700 text-gold-accent font-semibold' : 'text-white'}`}>Admin</button></li>
                    <li>
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className="w-full text-left py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 flex items-center"
                            title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                        >
                            {darkMode ? (
                                <svg className="lucide lucide-sun w-6 h-6 text-white mr-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.93 19.07l1.41-1.41"/><path d="M17.66 6.34l1.41-1.41"/></svg>
                            ) : (
                                <svg className="lucide lucide-moon w-6 h-6 text-white mr-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                            )}
                            {darkMode ? "Light Mode" : "Dark Mode"}
                        </button>
                    </li>
                </ul>
            </div>

            {/* Main Content Wrapper */}
            <div className={`transition-transform duration-300 ${isSideNavOpen ? 'md:ml-[250px]' : 'md:ml-0'}`}>
                {/* Top Bar (Sticky Header) */}
                <header className={`sticky top-0 z-50 ${darkMode ? 'bg-primary-dark-blue' : 'bg-primary-dark-blue'} p-4 shadow-lg border-b ${darkMode ? 'border-blue-900' : 'border-blue-700'}`}>
                    <nav className="flex items-center justify-between max-w-7xl mx-auto">
                        <button onClick={() => setIsSideNavOpen(!isSideNavOpen)} className="p-2 text-white md:hidden">
                            <svg className="lucide lucide-menu w-8 h-8" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
                        </button>
                        <div className="text-xl font-bold text-white hidden md:block">
                            <span className="text-white">[</span> RF Federal Laws <span className="text-white">]</span>
                        </div>
                        {/* Desktop Navigation */}
                        <ul className="hidden md:flex space-x-6 text-lg font-roboto">
                            <li><button onClick={() => navigateTo('home')} className={`hover:text-gold-accent transition duration-150 ${currentPage === 'home' ? 'text-gold-accent font-semibold' : 'text-white'}`}>Home</button></li>
                            <li><button onClick={() => navigateTo('browse')} className={`hover:text-gold-accent transition duration-150 ${currentPage === 'browse' ? 'text-gold-accent font-semibold' : 'text-white'}`}>Browse Laws</button></li>
                            <li><button onClick={() => navigateTo('about')} className={`hover:text-gold-accent transition duration-150 ${currentPage === 'about' ? 'text-gold-accent font-semibold' : 'text-white'}`}>About</button></li>
                            <li><button onClick={() => navigateTo('admin')} className={`hover:text-gold-accent transition duration-150 ${currentPage === 'admin' ? 'bg-blue-700 text-gold-accent font-semibold' : 'text-white'}`}>Admin</button></li>
                            <li>
                                <button
                                    onClick={() => setDarkMode(!darkMode)}
                                    className="ml-4 p-2 rounded-full bg-transparent hover:bg-white hover:bg-opacity-20 transition duration-200"
                                    title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                                >
                                    {darkMode ? (
                                        <svg className="lucide lucide-sun w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.93 19.07l1.41-1.41"/><path d="M17.66 6.34l1.41-1.41"/></svg>
                                    ) : (
                                        <svg className="lucide lucide-moon w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                                    )}
                                </button>
                            </li>
                        </ul>
                    </nav>
                </header>

                {/* Main Content Area */}
                <main className="max-w-7xl mx-auto py-8">
                    {renderContent()}
                </main>

                {/* Footer */}
                <footer className={`p-4 text-center text-sm ${darkMode ? 'bg-primary-dark-blue text-blue-200' : 'bg-primary-dark-blue text-white'} border-t ${darkMode ? 'border-blue-900' : 'border-blue-700'} mt-8`}>
                    &copy; 2025 Russian Federation (Simulation) - Official Legal Repository. All rights reserved.
                </footer>
            </div>
        </div>
    );
}

// Component for displaying individual law details
const LawPageTemplate = ({ law, onBack, darkMode }) => {
    const cardBg = darkMode ? 'bg-dark-card' : 'bg-white';
    const textColor = darkMode ? 'text-white' : 'text-dark-text';
    const secondaryTextColor = darkMode ? 'text-gray-400' : 'text-secondary-grey';
    const inputBorder = darkMode ? 'border-input-border-dark' : 'border-secondary-grey';


    return (
        <div className={`${cardBg} p-8 rounded-lg shadow-lg border ${inputBorder}`}>
            <button onClick={onBack} className="btn-secondary mb-6">← Back</button>

            {/* Header */}
            <div className="mb-6 pb-4 border-b border-secondary-grey">
                <h2 className={`text-3xl md:text-4xl font-pt-serif font-bold ${textColor} mb-2`}>{law.name}</h2>
                <p className={`text-xl font-roboto ${secondaryTextColor} mb-2`}>Law #{law.number || 'N/A'} ({law.year})</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 text-sm text-dark-text">
                    <p>📅 <span className="font-semibold">Date Enacted:</span> {law.date}</p>
                    <p>🏛️ <span className="font-semibold">Passed by:</span> State Duma</p>
                    <p>✅ <span className="font-semibold">Status:</span> <span className="text-green-500 font-bold">{law.status}</span></p>
                    <p>✍️ <span className="font-semibold">Sponsor:</span> {law.ministry}</p>
                </div>
            </div>

            {/* Full Document Section - now only a button */}
            <div className="mb-6 text-center">
                <h3 className={`text-2xl font-pt-serif font-bold ${textColor} mb-3`}>📘 Full Document</h3>
                {law.pdfUrl ? (
                    <a
                        href={law.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-6 py-3 bg-primary-dark-blue text-white font-bold rounded-md shadow-lg hover:bg-blue-800 transition duration-300 transform hover:scale-105"
                    >
                        <svg className="lucide lucide-external-link w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                        Open Full Document
                    </a>
                ) : (
                    <p className={`${secondaryTextColor}`}>No external document link available for this law.</p>
                )}
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-secondary-grey">
                <p className={`text-sm ${secondaryTextColor}`}>Last Reviewed: {new Date().toISOString().slice(0, 10)}</p>
            </div>
        </div>
    );
};

// Admin Login Page Component
const AdminLoginPage = ({ onLogin, message }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(username, password);
    };

    return (
        <div className="flex items-center justify-center min-h-[calc(100vh-140px)]">
            <div className="bg-white p-8 rounded-lg shadow-lg border border-secondary-grey w-full max-w-md">
                <h2 className="text-3xl font-pt-serif font-bold text-dark-text text-center mb-6">Admin Login</h2>
                {message && (
                    <div className={`p-3 mb-4 rounded-md ${message.includes('successful') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {message}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-dark-text text-sm font-bold mb-2" htmlFor="username">
                            Username
                        </label>
                        <input
                            type="text"
                            id="username"
                            className="input-field"
                            placeholder="admin"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-dark-text text-sm font-bold mb-2" htmlFor="password">
                            Password
                        </label>
                        <input
                            type="password"
                            id="password"
                            className="input-field"
                            placeholder="password123"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary w-full">Login</button>
                </form>
            </div>
        </div>
    );
};

// Admin Dashboard Component
const AdminDashboard = ({ onLogout, message, onManageLaw, allLaws, staticLegalTitles, isAuthReady }) => {
    // Combine static titles and any unique titles from existing laws for the dropdown
    const allTitleCategories = [...new Set([
        ...staticLegalTitles.map(title => title.name),
        ...allLaws.map(law => law.titleCategory)
    ].filter(Boolean))].sort();

    const [selectedLawId, setSelectedLawId] = useState('');
    const [lawName, setLawName] = useState('');
    const [lawNumber, setLawNumber] = useState('');
    const [lawYear, setLawYear] = useState('');
    const [lawDate, setLawDate] = useState('');
    const [lawMinistry, setLawMinistry] = useState('');
    const [pdfUrl, setPdfUrl] = useState('');
    const [lawText, setLawText] = useState('');
    const [lawStatus, setLawStatus] = useState('In Effect');
    const [lawTitleCategory, setLawTitleCategory] = useState('');

    useEffect(() => {
        if (selectedLawId) {
            const lawToEdit = allLaws.find(law => law.id === selectedLawId);
            if (lawToEdit) {
                setLawName(lawToEdit.name || '');
                setLawNumber(lawToEdit.number || '');
                setLawYear(lawToEdit.year || '');
                setLawDate(lawToEdit.date || '');
                setLawMinistry(lawToEdit.ministry || '');
                setPdfUrl(lawToEdit.pdfUrl || '');
                setLawText(lawToEdit.text || '');
                setLawStatus(lawToEdit.status || 'In Effect');
                setLawTitleCategory(lawToEdit.titleCategory || '');
            }
        } else {
            // Reset form when no law is selected (for "Add New Law" mode)
            setLawName('');
            setLawNumber('');
            setLawYear('');
            setLawDate('');
            setLawMinistry('');
            setPdfUrl('');
            setLawText('');
            setLawStatus('In Effect');
            setLawTitleCategory('');
        }
    }, [selectedLawId, allLaws]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        const actionType = e.nativeEvent.submitter.name;

        const lawData = {
            name: lawName,
            number: lawNumber || null, // Make lawNumber optional, save as null if empty
            year: parseInt(lawYear),
            date: lawDate,
            ministry: lawMinistry,
            pdfUrl: pdfUrl,
            text: lawText,
            status: lawStatus,
            titleCategory: lawTitleCategory
        };

        if (selectedLawId && (actionType === 'edit' || actionType === 'delete')) {
            lawData.id = selectedLawId; // Add ID for edit/delete operations
        }

        await onManageLaw(lawData, actionType);

        // Reset form fields after submission
        setSelectedLawId('');
        setLawName('');
        setLawNumber('');
        setLawYear('');
        setLawDate('');
        setLawMinistry('');
        setPdfUrl('');
        setLawText('');
        setLawStatus('In Effect');
        setLawTitleCategory('');
    };

    const formDisabled = !isAuthReady; // Disable form if Firebase Auth is not ready

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-pt-serif font-bold text-primary-dark-blue">Admin Dashboard</h2>
                <button onClick={onLogout} className="btn-secondary">Logout</button>
            </div>
            {message && (
                <div className={`p-3 mb-4 rounded-md ${message.includes('successful') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {message}
                </div>
            )}
            {formDisabled && (
                <div className="p-4 mb-4 text-center text-blue-700 bg-blue-100 rounded-md">
                    Loading Firebase authentication... Please wait.
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Manage Law (Add/Edit/Delete) */}
                <div className="bg-white p-6 rounded-lg shadow-lg border border-secondary-grey col-span-1 md:col-span-2">
                    <h3 className="text-xl font-pt-serif font-semibold text-dark-text mb-4">📝 Manage Law</h3>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <label className="block text-dark-text text-sm font-bold mb-1">Select Law to Edit/Delete or Add New:</label>
                        <select
                            name="lawId"
                            className="input-field"
                            value={selectedLawId}
                            onChange={(e) => setSelectedLawId(e.target.value)}
                            disabled={formDisabled}
                        >
                            <option value="">-- Add New Law --</option>
                            {allLaws.map(law => <option key={law.id} value={law.id}>{law.name} ({law.number || 'N/A'})</option>)}
                        </select>

                        <label className="block text-dark-text text-sm font-bold mb-1">Law Name:</label>
                        <input type="text" name="lawName" placeholder="Law Name" className="input-field" value={lawName} onChange={(e) => setLawName(e.target.value)} required disabled={formDisabled} />

                        <label className="block text-dark-text text-sm font-bold mb-1">Law Number (Optional):</label>
                        <input type="text" name="lawNumber" placeholder="Law Number (e.g., FZ-2025-01)" className="input-field" value={lawNumber} onChange={(e) => setLawNumber(e.target.value)} disabled={formDisabled} />

                        <label className="block text-dark-text text-sm font-bold mb-1">Year Enacted:</label>
                        <input type="number" name="lawYear" placeholder="Year Enacted (e.g., 2025)" className="input-field" value={lawYear} onChange={(e) => setLawYear(e.target.value)} required disabled={formDisabled} />

                        <label className="block text-dark-text text-sm font-bold mb-1">Date Enacted:</label>
                        <input type="date" name="lawDate" placeholder="Date Enacted" className="input-field" value={lawDate} onChange={(e) => setLawDate(e.target.value)} required disabled={formDisabled} />

                        <label className="block text-dark-text text-sm font-bold mb-1">Sponsor:</label>
                        <input type="text" name="lawMinistry" placeholder="Sponsor (e.g., Ministry of Justice)" className="input-field" value={lawMinistry} onChange={(e) => setLawMinistry(e.target.value)} required disabled={formDisabled} />

                        <label className="block text-dark-text text-sm font-bold mb-1">External Document URL (Optional):</label>
                        <input type="url" name="pdfUrl" placeholder="External Document URL (e.g., Google Docs link)" className="input-field" value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} disabled={formDisabled} />

                        <label className="block text-dark-text text-sm font-bold mb-1">Brief Law Text (for search preview):</label>
                        <textarea name="lawText" placeholder="Brief Law Text (for search preview)" rows="3" className="input-field" value={lawText} onChange={(e) => setLawText(e.target.value)} disabled={formDisabled}></textarea>

                        <label className="block text-dark-text text-sm font-bold mb-1">Status:</label>
                        <select name="lawStatus" className="input-field" value={lawStatus} onChange={(e) => setLawStatus(e.target.value)} disabled={formDisabled}>
                            <option value="In Effect">In Effect</option>
                            <option value="Draft">Draft</option>
                            <option value="Repealed">Repealed</option>
                        </select>
                        <label className="block text-dark-text text-sm font-bold mb-1">Title Category:</label>
                        <select name="lawTitleCategory" className="input-field" value={lawTitleCategory} onChange={(e) => setLawTitleCategory(e.target.value)} required disabled={formDisabled}>
                            <option value="">Select Title Category</option>
                            {allTitleCategories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
                        </select>
                        <div className="flex gap-4">
                            <button type="submit" name="add" className="btn-primary w-1/2" disabled={formDisabled || selectedLawId}>
                                Add New Law
                            </button>
                            <button type="submit" name="edit" className="btn-primary w-1/2" disabled={formDisabled || !selectedLawId}>
                                Edit Law
                            </button>
                            <button type="submit" name="delete" className="bg-red-600 text-white font-bold py-2 px-4 rounded-md shadow-md hover:bg-red-700 transition duration-200 w-1/2" disabled={formDisabled || !selectedLawId}>
                                Delete Law
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// New component for listing laws under a specific title
const LawListByTitlePage = ({ title, laws, navigateTo, darkMode }) => { // Now accepts 'laws' prop
    const cardBg = darkMode ? 'bg-dark-card' : 'bg-white';
    const textColor = darkMode ? 'text-white' : 'text-dark-text';
    const secondaryTextColor = darkMode ? 'text-gray-400' : 'text-secondary-grey';
    const inputBorder = darkMode ? 'border-input-border-dark' : 'border-secondary-grey';

    // Filter the laws passed down based on the current title category
    const filteredLaws = laws.filter(law => law.titleCategory === title.name);

    return (
        <div className={`p-6 ${darkMode ? 'dark-mode' : 'light-mode'}`}>
            <h2 className={`text-3xl font-pt-serif font-bold ${textColor} text-center mb-6`}>{title.name}</h2>
            <button onClick={() => navigateTo('browse')} className="btn-secondary mb-6">← Back to Titles</button>
            <div className="space-y-4">
                {filteredLaws.length > 0 ? (
                    filteredLaws.map(law => (
                        <div
                            key={law.id}
                            className={`${cardBg} p-4 rounded-lg shadow-md border ${inputBorder} hover:border-accent-red transition duration-200 cursor-pointer`}
                        >
                            <div onClick={() => navigateTo('law-page', law)}>
                                <h3 className={`text-lg font-pt-serif font-semibold ${textColor}`}>{law.name}</h3>
                                <p className={`${secondaryTextColor} text-sm`}>Designation: {law.number || 'N/A'} | Status: {law.status} | Enacted: {law.date}</p>
                            </div>
                            {law.pdfUrl && (
                                <a
                                    href={law.pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center px-3 py-1 bg-primary-dark-blue text-white text-sm font-bold rounded-md shadow-sm hover:bg-blue-800 transition duration-200"
                                >
                                    <svg className="lucide lucide-file-text w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
                                    View Document
                                </a>
                            )}
                        </div>
                    ))
                ) : (
                    <p className={`text-center ${secondaryTextColor} py-8`}>No laws found under this title.</p>
                )}
            </div>
        </div>
    );
};

export default App;
