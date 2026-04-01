import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { toast } from 'sonner';
import { styles } from '../theme';
import { Lock, Mail, Loader2 } from 'lucide-react';

const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Logged in successfully");
      navigate('/admin');
    } catch (error: any) {
      console.error("Login error", error);
      toast.error(error.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-[#F8F9FD]">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-[#5D5FEF] text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Lock size={32} />
          </div>
          <h1 className="text-3xl font-bold">Admin Portal</h1>
          <p className="text-gray-500">Secure access for Trip Sutra administrators</p>
        </div>

        <div className={styles.card}>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className={styles.label}>Email Address</label>
              <div className="relative">
                <input 
                  type="email" 
                  required
                  className={`${styles.input} pl-11`}
                  placeholder="admin@tripsutra.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                <Mail className="absolute left-4 top-3.5 text-gray-400" size={18} />
              </div>
            </div>

            <div>
              <label className={styles.label}>Password</label>
              <div className="relative">
                <input 
                  type="password" 
                  required
                  className={`${styles.input} pl-11`}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className={`${styles.buttonPrimary} w-full flex items-center justify-center gap-2`}
            >
              {loading ? <Loader2 className="animate-spin" /> : null}
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
        
        <p className="text-center mt-8 text-sm text-gray-400">
          Authorized access only. All activities are logged.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
