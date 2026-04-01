import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc,
  orderBy,
  where
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  Check, 
  X, 
  Trash2, 
  ExternalLink, 
  MapPin, 
  Clock, 
  Tag,
  Loader2,
  ChevronDown,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

import { AlertCircle } from 'lucide-react';

const AdminDashboard = () => {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const navigate = useNavigate();

  const isFirebaseConfigured = auth && db && Object.keys(db).length > 0;

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }

    let unsubscribeData: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/admin/login');
        return;
      }

      // Only fetch data if user is logged in
      const q = query(
        collection(db, 'place_suggestions'), 
        orderBy('created_at', 'desc')
      );

      unsubscribeData = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setSuggestions(data);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching suggestions", error);
        const errInfo = {
          error: error.message,
          operation: 'list',
          path: 'place_suggestions',
          authInfo: {
            userId: auth.currentUser?.uid,
            email: auth.currentUser?.email,
          }
        };
        console.error('Firestore Error [list]:', JSON.stringify(errInfo));
        toast.error("Failed to load suggestions");
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeData) unsubscribeData();
    };
  }, [navigate, isFirebaseConfigured]);

  const handleFirestoreError = (error: any, operation: string, path: string) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      },
      operation,
      path
    };
    console.error(`Firestore Error [${operation}]:`, JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  };

  const handleApprove = async (suggestion: any) => {
    try {
      // 1. Add to approved_places
      await addDoc(collection(db, 'approved_places'), {
        place_name: suggestion.place_name,
        category: suggestion.category,
        description: suggestion.description,
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        city: suggestion.city,
        state: suggestion.state,
        country: suggestion.country,
        image_url: suggestion.image_url,
        approved_at: new Date().toISOString(),
        original_suggestion_id: suggestion.id
      });

      // 2. Update status in place_suggestions
      await updateDoc(doc(db, 'place_suggestions', suggestion.id), {
        status: 'approved'
      });

      toast.success(`${suggestion.place_name} approved!`);
    } catch (error) {
      handleFirestoreError(error, 'write', 'approved_places/place_suggestions');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateDoc(doc(db, 'place_suggestions', id), {
        status: 'rejected'
      });
      toast.info("Suggestion rejected");
    } catch (error) {
      handleFirestoreError(error, 'update', `place_suggestions/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this suggestion?")) return;
    try {
      await deleteDoc(doc(db, 'place_suggestions', id));
      toast.success("Suggestion deleted");
    } catch (error) {
      handleFirestoreError(error, 'delete', `place_suggestions/${id}`);
    }
  };

  const filteredSuggestions = suggestions.filter(s => {
    const matchesStatus = filter === 'all' ? true : s.status === filter;
    const matchesCategory = categoryFilter === 'All' ? true : s.category === categoryFilter;
    const matchesSearch = s.place_name.toLowerCase().includes(search.toLowerCase()) || 
                         s.city.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesCategory && matchesSearch;
  });

  if (!isFirebaseConfigured) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="bg-white p-12 rounded-[32px] shadow-xl border border-orange-50">
          <div className="w-20 h-20 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={48} />
          </div>
          <h2 className="text-3xl font-bold mb-4">Firebase Not Connected</h2>
          <p className="text-gray-600 text-lg mb-8">
            To use the admin dashboard, you must add your Firebase API keys to the environment variables in the AI Studio settings.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-[#5D5FEF]" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-500">Review and manage place suggestions</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-1 flex">
            {['pending', 'approved', 'rejected', 'all'].map(s => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === s ? 'bg-[#5D5FEF] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
        <div className="lg:col-span-2 relative">
          <input 
            type="text" 
            placeholder="Search by name or city..." 
            className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-11 pr-4 focus:ring-2 focus:ring-[#5D5FEF] outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <Search className="absolute left-4 top-3.5 text-gray-400" size={18} />
        </div>
        
        <div className="relative">
          <select 
            className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 appearance-none focus:ring-2 focus:ring-[#5D5FEF] outline-none"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="All">All Categories</option>
            {["Temple", "Monument", "Restaurant", "Hotel", "Tourist Attraction", "Other"].map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={18} />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl py-3 px-4 flex items-center justify-between">
          <span className="text-gray-500 text-sm">Total Results:</span>
          <span className="font-bold text-[#5D5FEF]">{filteredSuggestions.length}</span>
        </div>
      </div>

      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredSuggestions.length > 0 ? (
            filteredSuggestions.map((s) => (
              <motion.div 
                layout
                key={s.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row">
                  {s.image_url && (
                    <div className="md:w-48 h-48 md:h-auto overflow-hidden">
                      <img 
                        src={s.image_url} 
                        alt={s.place_name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                        onError={(e) => (e.currentTarget.src = 'https://picsum.photos/seed/travel/400/300')}
                      />
                    </div>
                  )}
                  
                  <div className="flex-1 p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-xl font-bold">{s.place_name}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            s.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            s.status === 'approved' ? 'bg-green-100 text-green-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {s.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Tag size={14} className="text-[#5D5FEF]" />
                            {s.category}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin size={14} className="text-[#5D5FEF]" />
                            {s.city}, {s.state}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={14} className="text-[#5D5FEF]" />
                            {s.created_at?.toDate().toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <a 
                          href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-gray-400 hover:text-[#5D5FEF] hover:bg-blue-50 rounded-lg transition-all"
                          title="View on Maps"
                        >
                          <ExternalLink size={20} />
                        </a>
                        <button 
                          onClick={() => handleDelete(s.id)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>

                    <p className="text-gray-600 mb-4 line-clamp-2">{s.description || 'No description provided.'}</p>

                    {/* AI Verification Badge */}
                    {s.ai_verification && (
                      <div className={`mb-6 p-4 rounded-2xl border flex items-start gap-3 ${
                        s.ai_verification.is_real 
                          ? 'bg-blue-50 border-blue-100 text-blue-800' 
                          : 'bg-orange-50 border-orange-100 text-orange-800'
                      }`}>
                        <div className={`p-2 rounded-xl ${s.ai_verification.is_real ? 'bg-blue-100' : 'bg-orange-100'}`}>
                          {s.ai_verification.is_real ? <Sparkles size={18} /> : <AlertTriangle size={18} />}
                        </div>
                        <div className="w-full">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-sm">AI Smart Verification</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              s.ai_verification.confidence > 80 ? 'bg-green-100 text-green-700' :
                              s.ai_verification.confidence > 50 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {s.ai_verification.confidence}% Confidence
                            </span>
                            {/* Custom Tag for Real/Fake */}
                            {s.ai_verification.is_real ? (
                              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-500 text-white">Confidential</span>
                            ) : (
                              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500 text-white">Fake</span>
                            )}
                          </div>
                          <p className="text-xs opacity-90 leading-relaxed">
                            {s.ai_verification.summary}
                            {s.ai_verification.suggested_category && s.ai_verification.suggested_category !== s.category && (
                              <span className="block mt-1 font-semibold">
                                Suggested Category: {s.ai_verification.suggested_category}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    {s.status === 'pending' && (
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => handleApprove(s)}
                          className="flex-1 bg-green-500 text-white font-bold py-2 px-4 rounded-xl hover:bg-green-600 transition-all flex items-center justify-center gap-2"
                        >
                          <Check size={18} />
                          Approve
                        </button>
                        <button 
                          onClick={() => handleReject(s.id)}
                          className="flex-1 bg-white text-red-500 border border-red-200 font-bold py-2 px-4 rounded-xl hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                        >
                          <X size={18} />
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-[32px] border border-dashed border-gray-200">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="text-gray-300" size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-400">No suggestions found</h3>
              <p className="text-gray-400">Try adjusting your filters or search terms</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminDashboard;
