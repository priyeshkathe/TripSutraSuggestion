import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';
import { db, auth, googleProvider } from '../firebase';
import { styles } from '../theme';
import { MapPin, CheckCircle2, Loader2, Plus, Navigation, Link as LinkIcon, Globe, Map as MapIcon, Sparkles, Image as ImageIcon, X, AlertCircle, LogIn } from 'lucide-react';
import { verifyPlaceWithAI } from '../services/geminiService';

const categories = ["Temple", "Monument", "Restaurant", "Hotel", "Tourist Attraction", "Other"];

const SuggestPlace = ({ onShowPrompt }: { onShowPrompt: () => void }) => {
  const [formData, setFormData] = useState({
    place_name: '',
    category: '',
    description: '',
    latitude: 0,
    longitude: 0,
    city: '',
    state: '',
    country: '',
    image_url: '',
    location_link: '',
  });
  const [loading, setLoading] = useState(false);
  const [aiVerifying, setAiVerifying] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locationMethod, setLocationMethod] = useState<'current' | 'link' | null>(null);
  const [user, setUser] = useState<any>(null);

  const isFirebaseConfigured = auth && db && Object.keys(db).length > 0;

  useEffect(() => {
    if (auth) {
      const unsubscribe = auth.onAuthStateChanged((u: any) => {
        setUser(u);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Logged in successfully!");
    } catch (error) {
      console.error("Login failed:", error);
      toast.error("Login failed. Please try again.");
    }
  };

  const parseGoogleMapsLink = (link: string) => {
    try {
      // Pattern for @lat,lng
      const atMatch = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (atMatch) {
        return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
      }

      // Pattern for q=lat,lng
      const qMatch = link.match(/q=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (qMatch) {
        return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
      }

      // Pattern for ll=lat,lng
      const llMatch = link.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (llMatch) {
        return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
      }

      return null;
    } catch (e) {
      return null;
    }
  };

  const updateAddressFromCoords = async (lat: number, lng: number) => {
    const toastId = toast.loading("Fetching address details...");
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`);
      const data = await response.json();
      
      if (data && data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.county || '';
        const state = data.address.state || '';
        const country = data.address.country || '';
        
        setFormData(prev => ({ 
          ...prev, 
          city: city || prev.city, 
          state: state || prev.state, 
          country: country || prev.country 
        }));
        toast.success("Address details updated!", { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (err) {
      console.error("Reverse geocoding failed", err);
      toast.error("Failed to fetch address details", { id: toastId });
    }
  };

  const handleLinkChange = async (link: string) => {
    setFormData(prev => ({ ...prev, location_link: link }));
    const coords = parseGoogleMapsLink(link);
    if (coords) {
      setFormData(prev => ({ 
        ...prev, 
        latitude: coords.lat, 
        longitude: coords.lng 
      }));
      toast.success("Coordinates extracted from link!");
      await updateAddressFromCoords(coords.lat, coords.lng);
    }
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    const permission = localStorage.getItem('locationPermission');
    if (permission === 'denied') {
      toast.warning("Location access was previously declined. Please enable it to use this feature.");
      onShowPrompt();
      return;
    }

    setLocating(true);
    setLocationMethod('current');
    
    // Force a fresh, high-accuracy reading
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        console.log(`Location captured with accuracy: ${accuracy} meters`);
        
        localStorage.setItem('locationPermission', 'granted');
        setFormData(prev => ({ ...prev, latitude, longitude }));
        toast.success(`Location captured! (Accuracy: ${Math.round(accuracy)}m)`);
        
        await updateAddressFromCoords(latitude, longitude);
        setLocating(false);
      },
      (error) => {
        console.error("Geolocation error", error);
        let msg = "Could not get your location.";
        if (error.code === 1) {
          msg = "Permission denied. Please allow location access.";
          localStorage.setItem('locationPermission', 'denied');
          onShowPrompt();
        }
        if (error.code === 3) msg = "Location request timed out. Try again.";
        toast.error(msg);
        setLocating(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 15000, 
        maximumAge: 0 
      }
    );
  };

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
      },
      operation,
      path
    };
    console.error(`Firestore Error [${operation}]:`, JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size too large. Max 5MB allowed.");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isFirebaseConfigured) {
      toast.error("Firebase is not configured. Please add your API keys to the environment variables.");
      return;
    }

    if (!formData.place_name || !formData.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setAiVerifying(true);
    const path = 'place_suggestions';
    
    try {
      const toastId = toast.loading("Verifying and submitting your suggestion...");

      // 1. AI Verification Task
      const aiResult = await verifyPlaceWithAI(
        formData.place_name,
        formData.category,
        formData.description,
        formData.city,
        formData.state
      );

      setAiVerifying(false);
      toast.dismiss(toastId);

      if (aiResult.isReal) {
        toast.success(`AI Verified: ${aiResult.summary}`);
      } else {
        toast.warning("AI could not verify this place, but we'll still submit it for admin review.");
      }

      // 2. Save to Firestore
      await addDoc(collection(db, path), {
        ...formData,
        status: 'pending',
        created_at: serverTimestamp(),
        ai_verification: {
          is_real: aiResult.isReal,
          confidence: aiResult.confidenceScore,
          summary: aiResult.summary,
          suggested_category: aiResult.suggestedCategory || null,
          warning: aiResult.warning || null,
          verified_at: new Date().toISOString()
        }
      });
      setSubmitted(true);
      toast.success("Place suggested successfully!");
    } catch (error) {
      handleFirestoreError(error, 'create', path);
    } finally {
      setLoading(false);
      setAiVerifying(false);
    }
  };

  const resetForm = () => {
    setFormData({
      place_name: '',
      category: '',
      description: '',
      latitude: 0,
      longitude: 0,
      city: '',
      state: '',
      country: '',
      image_url: '',
      location_link: '',
    });
    setSubmitted(false);
    setLocationMethod(null);
  };

  if (!isFirebaseConfigured) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="bg-white p-12 rounded-[32px] shadow-xl border border-orange-50">
          <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={48} />
          </div>
          <h2 className="text-3xl font-bold mb-4">Firebase Not Connected</h2>
          <p className="text-gray-600 text-lg mb-8">
            To use the suggestion feature and image uploads, you must add your Firebase API keys to the environment variables in the AI Studio settings.
          </p>
          <div className="text-left bg-gray-50 p-6 rounded-2xl font-mono text-sm mb-8">
            <p className="mb-2 font-bold text-gray-700">Required Variables:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li>VITE_FIREBASE_API_KEY</li>
              <li>VITE_FIREBASE_AUTH_DOMAIN</li>
              <li>VITE_FIREBASE_PROJECT_ID</li>
              <li>VITE_FIREBASE_STORAGE_BUCKET</li>
              <li>VITE_FIREBASE_APP_ID</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-12 rounded-[32px] shadow-xl border border-green-50"
        >
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-3xl font-bold mb-4">Thank You!</h2>
          <p className="text-gray-600 text-lg mb-8">
            Your suggestion for <span className="font-bold text-[#5D5FEF]">{formData.place_name}</span> has been submitted. 
            Our admin team will review it shortly.
          </p>
          <button 
            onClick={resetForm}
            className={styles.buttonPrimary}
          >
            Suggest Another Place
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold mb-2">Suggest a Place</h1>
        <p className="text-gray-500">Help us discover hidden gems and heritage sites.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className={styles.card}>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Plus size={20} className="text-[#5D5FEF]" />
              Basic Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className={styles.label}>Place Name *</label>
                <input 
                  type="text" 
                  required
                  className={styles.input}
                  placeholder="e.g. Trimbakeshwar Temple"
                  value={formData.place_name}
                  onChange={e => setFormData({ ...formData, place_name: e.target.value })}
                />
              </div>

              <div>
                <label className={styles.label}>Category *</label>
                <select 
                  required
                  className={styles.input}
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={styles.label}>Description</label>
                <textarea 
                  className={`${styles.input} h-32 resize-none`}
                  placeholder="Tell us more about this place..."
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div>
                <label className={styles.label}>Image URL (Optional)</label>
                <div className="relative">
                  <input 
                    type="url" 
                    className={styles.input}
                    placeholder="https://example.com/image.jpg"
                    value={formData.image_url}
                    onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                  />
                  <ImageIcon className="absolute right-4 top-3.5 text-gray-400" size={18} />
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Provide a direct link to an image of the place.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={styles.card}>
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <MapPin size={20} className="text-[#5D5FEF]" />
              Location Method
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <button
                type="button"
                onClick={handleLocateMe}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all gap-3 ${
                  locationMethod === 'current' 
                    ? 'border-[#5D5FEF] bg-[#5D5FEF]/5 text-[#5D5FEF]' 
                    : 'border-gray-100 hover:border-gray-200 text-gray-500'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  locationMethod === 'current' ? 'bg-[#5D5FEF] text-white' : 'bg-gray-100'
                }`}>
                  {locating ? <Loader2 className="animate-spin" size={24} /> : <Navigation size={24} />}
                </div>
                <div className="text-center">
                  <span className="block font-bold">Current Location</span>
                  <span className="text-xs opacity-70">Use your device GPS</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setLocationMethod('link')}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all gap-3 ${
                  locationMethod === 'link' 
                    ? 'border-[#5D5FEF] bg-[#5D5FEF]/5 text-[#5D5FEF]' 
                    : 'border-gray-100 hover:border-gray-200 text-gray-500'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  locationMethod === 'link' ? 'bg-[#5D5FEF] text-white' : 'bg-gray-100'
                }`}>
                  <LinkIcon size={24} />
                </div>
                <div className="text-center">
                  <span className="block font-bold">Paste Link</span>
                  <span className="text-xs opacity-70">Google Maps URL</span>
                </div>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {locationMethod === 'link' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-6 overflow-hidden"
                >
                  <label className={styles.label}>Google Maps Link</label>
                  <div className="relative">
                    <input 
                      type="url" 
                      className={styles.input}
                      placeholder="https://www.google.com/maps/place/..."
                      value={formData.location_link}
                      onChange={e => handleLinkChange(e.target.value)}
                    />
                    <Globe className="absolute right-4 top-3.5 text-gray-400" size={18} />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Paste the full URL from Google Maps. We'll try to extract the coordinates automatically.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className={styles.label}>Latitude</label>
                <input 
                  type="number" 
                  step="any"
                  className={styles.input} 
                  value={formData.latitude || ''} 
                  onChange={e => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                  placeholder="0.000000"
                />
              </div>
              <div>
                <label className={styles.label}>Longitude</label>
                <input 
                  type="number" 
                  step="any"
                  className={styles.input} 
                  value={formData.longitude || ''} 
                  onChange={e => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                  placeholder="0.000000"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className={styles.label}>City</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={formData.city} 
                  onChange={e => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g. Nashik"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={styles.label}>State</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={formData.state} 
                    onChange={e => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. Maharashtra"
                  />
                </div>
                <div>
                  <label className={styles.label}>Country</label>
                  <input 
                    type="text" 
                    className={styles.input} 
                    value={formData.country} 
                    onChange={e => setFormData({ ...formData, country: e.target.value })}
                    placeholder="e.g. India"
                  />
                </div>
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`${styles.buttonPrimary} w-full flex items-center justify-center gap-2 py-4 text-lg`}
          >
            {loading ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
            {loading ? 'Submitting...' : 'Submit Suggestion'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SuggestPlace;
