/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowUpDown,
  Plus, 
  Share2, 
  Heart, 
  Music, 
  Video, 
  Image as ImageIcon, 
  Mic,
  X,
  Send,
  QrCode,
  Download,
  LogIn,
  Repeat,
  CheckCircle2,
  Bookmark,
  LayoutGrid,
  Sparkles,
  Calendar,
  Facebook,
  MessageSquare,
  AtSign,
  Code2
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { cn } from './lib/utils';
import { VibeItem, VibeType } from './types';
import { VibeCard } from './components/VibeCard';
import { suggestEmotion, checkHasApiKey, requestApiKey, generateAIVideo, generateAIImage } from './services/geminiService';
import { 
  db, 
  auth, 
  loginWithGoogle, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  orderBy, 
  where,
  updateDoc,
  doc,
  deleteDoc
} from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function App() {
  const triggerHaptic = (pattern: number | number[]) => {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // Prevent crashes when running in sandboxed iframes without permission
      }
    }
  };

  const [items, setItems] = useState<VibeItem[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isQRPortalOpen, setIsQRPortalOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [isIdentifying, setIsIdentifying] = useState(true);
  const [vaultId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('v') || 'family-vault-1';
  });

  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [newVibeContent, setNewVibeContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<{name: string, data: string}[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<VibeType | 'code'>('emotion');
  const [selectedEmoji, setSelectedEmoji] = useState('✨');
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiImagePrompt, setAiImagePrompt] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [editingItem, setEditingItem] = useState<VibeItem | null>(null);
  const [viewingItem, setViewingItem] = useState<VibeItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<VibeItem | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showOnlyLiked, setShowOnlyLiked] = useState(false);
  const [showOnlyBookmarked, setShowOnlyBookmarked] = useState(false);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('item');
  });

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // If already standalone loaded
    if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
      setIsInstallable(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    } else {
      setShowInstallGuide(true);
    }
  };

  const EMOJI_LIST = ['✨', '❤️', '🔥', '🌈', '🌙', '🌊', '🌸', '🎸', '🎮', '🍕', '🚀', '🍀', '💃', '🥑', '⚡', '💎'];

  useEffect(() => {
    checkHasApiKey().then(setHasApiKey);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'upload') {
      setIsUploadOpen(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setUserName(u.displayName || 'Family Member');
        setIsIdentifying(false);
      } else {
        const savedName = localStorage.getItem('vibe_user_name');
        const hasVaultParam = new URLSearchParams(window.location.search).has('v');
        if (savedName) {
          setUserName(savedName);
          setIsIdentifying(false);
        } else if (hasVaultParam) {
          // Auto-sign in as guest if coming from a shared link or barcode
          setUserName('Family Guest');
          setIsIdentifying(false);
        }
      }
    });

    const q = query(
      collection(db, 'vibes'),
      where('vaultId', '==', vaultId),
      orderBy('createdAt', sortOrder)
    );

    const unsubscribeVibes = onSnapshot(q, (snapshot) => {
      const vibes = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as VibeItem[];
      setItems(vibes);

      // Handle highlighting specific item
      if (highlightItemId) {
        const item = vibes.find(v => v.id === highlightItemId);
        if (item) setViewingItem(item);
        
        setTimeout(() => {
          const element = document.getElementById(`vibe-${highlightItemId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            element.classList.add('ring-4', 'ring-yellow-400', 'ring-offset-8', 'ring-offset-pink-50');
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-yellow-400', 'ring-offset-8', 'ring-offset-pink-50');
              setHighlightItemId(null);
            }, 3000);
          }
        }, 500);
      }
    }, (error) => {
      console.error("Firestore error:", error);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeVibes();
    };
  }, [vaultId, highlightItemId, sortOrder]);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (userName.trim()) {
      localStorage.setItem('vibe_user_name', userName);
      setIsIdentifying(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles: {name: string, data: string}[] = [];
      const filesArray = Array.from(files) as File[];
      let processedCount = 0;

      filesArray.forEach((file: File) => {
        if (file.size > 1024 * 1024) {
          alert(`File "${file.name}" is too large (> 1MB).`);
          processedCount++;
          return;
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
          newFiles.push({ name: file.name, data: reader.result as string });
          processedCount++;
          if (processedCount === filesArray.length) {
            setSelectedFiles(prev => [...prev, ...newFiles]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleAddVibe = async () => {
    if (!newVibeContent.trim() && selectedFiles.length === 0) return;
    setIsUploading(true);

    try {
      const vibesToCreate = [];

      if (newVibeContent.trim()) {
        const emotion = await suggestEmotion(newVibeContent);
        vibesToCreate.push({
          type: selectedType,
          content: (selectedType === 'emotion' || (selectedType as any) === 'code') ? newVibeContent : undefined,
          url: (selectedType !== 'emotion' && (selectedType as any) !== 'code') ? newVibeContent : undefined,
          emotion,
          emoji: selectedType === 'emotion' ? selectedEmoji : null,
          createdAt: Date.now(),
          senderName: userName,
          senderEmail: user?.email || null,
          vaultId,
          isRemix: !!editingItem,
          originalVibeId: editingItem?.id || null
        });
      }

      for (const file of selectedFiles) {
        const emotion = await suggestEmotion(file.name);
        vibesToCreate.push({
          type: selectedType,
          url: file.data,
          emotion,
          createdAt: Date.now(),
          senderName: userName,
          senderEmail: user?.email || null,
          vaultId,
          isRemix: !!editingItem,
          originalVibeId: editingItem?.id || null
        });
      }

      for (const data of vibesToCreate) {
        await addDoc(collection(db, 'vibes'), data);
      }

      triggerHaptic([40, 80, 40]);
      setNewVibeContent('');
      setSelectedFiles([]);
      setEditingItem(null);
      setSelectedEmoji('✨');
      setIsUploadOpen(false);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!aiImagePrompt.trim()) return;
    
    if (!hasApiKey) {
      await requestApiKey();
      setHasApiKey(true);
      return;
    }

    setIsGeneratingImage(true);
    setGenerationProgress('Starting image generation...');
    try {
      const imageUrl = await generateAIImage(aiImagePrompt, (status) => {
        setGenerationProgress(status);
      });

      const emotion = await suggestEmotion(aiImagePrompt);
      await addDoc(collection(db, 'vibes'), {
        type: 'image',
        url: imageUrl,
        emotion,
        createdAt: Date.now(),
        senderName: userName,
        senderEmail: user?.email || null,
        vaultId,
        content: aiImagePrompt
      });
      
      triggerHaptic([40, 80, 40]);
      setAiImagePrompt('');
      setIsUploadOpen(false);
    } catch (error: any) {
      console.error('Image generation failed:', error);
      alert(error.message || 'Generation failed. Try again.');
    } finally {
      setIsGeneratingImage(false);
      setGenerationProgress('');
    }
  };

  const handleGenerateVideo = async () => {
    if (!aiPrompt.trim()) return;
    
    if (!hasApiKey) {
      await requestApiKey();
      setHasApiKey(true);
      return; // Stop here and let them click again or handle successfully
    }

    setIsGeneratingVideo(true);
    setGenerationProgress('Starting generation...');
    try {
      const videoBlob = await generateAIVideo(aiPrompt, (status) => {
        setGenerationProgress(status);
      });

      // Convert blob to base64 for storage (respecting the 1MB limit check)
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        if (base64data.length > 1.5 * 1024 * 1024) { // Roughly 1MB limit for base64
          alert("Generated video is too large to store directly. Try a shorter prompt or lower resolution.");
          return;
        }

        const emotion = await suggestEmotion(aiPrompt);
        await addDoc(collection(db, 'vibes'), {
          type: 'video',
          url: base64data,
          emotion,
          createdAt: Date.now(),
          senderName: userName,
          senderEmail: user?.email || null,
          vaultId,
          content: aiPrompt
        });
        
        triggerHaptic([40, 80, 40]);
        setAiPrompt('');
        setIsUploadOpen(false);
      };
      reader.readAsDataURL(videoBlob);
    } catch (error: any) {
      console.error('Video generation failed:', error);
      alert(error.message || 'Generation failed. Try again.');
    } finally {
      setIsGeneratingVideo(false);
      setGenerationProgress('');
    }
  };

  const [sharingItem, setSharingItem] = useState<VibeItem | null>(null);

  const friends = React.useMemo(() => {
    const uniqueParticipants = new Map<string, { name: string; email: string | null }>();
    items.forEach(item => {
      // Key by email if exists, otherwise by name
      const key = item.senderEmail || item.senderName;
      if (!uniqueParticipants.has(key) && item.senderEmail !== user?.email) {
        uniqueParticipants.set(key, { name: item.senderName, email: item.senderEmail || null });
      }
    });
    return Array.from(uniqueParticipants.values());
  }, [items, user]);

  const handleShareWithFriend = async (email: string) => {
    if (!sharingItem) return;
    try {
      const currentItem = items.find(i => i.id === sharingItem.id);
      const updatedSharedWith = [...(currentItem?.sharedWithEmails || []), email];
      const vibeRef = doc(db, 'vibes', sharingItem.id);
      await updateDoc(vibeRef, {
        sharedWithEmails: Array.from(new Set(updatedSharedWith))
      });
    } catch (error) {
      console.error('Sharing failed:', error);
    }
  };

  const handleToggleLike = async (item: VibeItem) => {
    triggerHaptic(20);
    const vibeRef = doc(db, 'vibes', item.id);
    const userKey = user?.email || userName;
    const currentLikes = item.likes || [];
    
    const newLikes = currentLikes.includes(userKey)
      ? currentLikes.filter(l => l !== userKey)
      : [...currentLikes, userKey];

    try {
      await updateDoc(vibeRef, { likes: newLikes });
    } catch (error) {
      console.error('Like toggle failed:', error);
    }
  };

  const handleToggleBookmark = async (item: VibeItem) => {
    triggerHaptic(20);
    const vibeRef = doc(db, 'vibes', item.id);
    const userKey = user?.email || userName;
    const currentBookmarks = item.bookmarks || [];
    
    const newBookmarks = currentBookmarks.includes(userKey)
      ? currentBookmarks.filter(b => b !== userKey)
      : [...currentBookmarks, userKey];

    try {
      await updateDoc(vibeRef, { bookmarks: newBookmarks });
    } catch (error) {
      console.error('Bookmark toggle failed:', error);
    }
  };

  const confirmDelete = (item: VibeItem) => {
    // Sharp triplet vibration pattern for warnings
    triggerHaptic([60, 50, 60, 50, 80]);
    setItemToDelete(item);
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;

    // Dual-tap haptic confirmation
    triggerHaptic([30, 40, 30]);

    try {
      await deleteDoc(doc(db, 'vibes', itemToDelete.id));
      if (viewingItem && viewingItem.id === itemToDelete.id) {
        setViewingItem(null);
      }
      setItemToDelete(null);
    } catch (error) {
      console.error('Failed to remove item:', error);
    }
  };

  const filteredItems = React.useMemo(() => {
    let result = items;
    const userKey = user?.email || userName;
    
    if (showOnlyLiked) {
      result = result.filter(item => item.likes?.includes(userKey));
    }
    
    if (showOnlyBookmarked) {
      result = result.filter(item => item.bookmarks?.includes(userKey));
    }
    
    return result;
  }, [items, showOnlyLiked, showOnlyBookmarked, user, userName]);

  const startRemix = (item: VibeItem) => {
    setEditingItem(item);
    setSelectedType(item.type);
    setSelectedEmoji(item.emoji || '✨');
    setNewVibeContent(item.url || item.content || '');
    
    setIsUploadOpen(true);
  };

  const currentUrl = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}?v=${vaultId}` : '';
  const copyVaultLink = () => {
    navigator.clipboard.writeText(currentUrl);
    alert('Vault link copied to clipboard! Share the vibe.');
  };

  const isAdmin = user?.email === 'jessieleighbright@gmail.com';

  if (isIdentifying) {
    return (
      <div className="min-h-screen bg-pink-50 relative flex items-center justify-center p-4 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="absolute top-1/4 -right-20 w-80 h-80 bg-pink-200/50 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-indigo-200/50 blur-[120px] rounded-full animate-pulse delay-700" />

        <motion.div 
          initial={{ opacity: 0, y: 30, rotate: -1 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          className="max-w-md w-full space-y-12 text-center relative z-10"
        >
          <div className="space-y-6">
            <motion.div 
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-24 h-24 bg-pink-500 rounded-[32px] flex items-center justify-center text-white text-5xl font-black shadow-neo-pink mx-auto border-4 border-indigo-950"
            >
              V
            </motion.div>
            <h1 className="text-7xl font-black tracking-[-0.07em] text-indigo-950 lowercase">
              vibeily
            </h1>
            <p className="text-indigo-400 font-bold text-xl uppercase tracking-widest leading-tight">
              Unlock your box of <br/> digital magic.
            </p>
          </div>
          
          <div className="space-y-8 p-8 bg-white border-[6px] border-indigo-950 rounded-[40px] shadow-neo-lg">
            <form onSubmit={handleSaveName} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[4px] block text-left px-2">Identification</label>
                <input
                  type="text"
                  placeholder="WHATS YOUR NAME?"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full bg-pink-50 border-4 border-indigo-950 rounded-2xl px-6 py-5 outline-none focus:bg-white transition-all text-center text-2xl font-black placeholder-indigo-200 lowercase tracking-tight shadow-inner"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={!userName.trim()}
                className="w-full bg-indigo-950 hover:bg-indigo-900 disabled:opacity-50 py-5 rounded-2xl font-black text-white text-xl transition-all shadow-neo active:translate-x-1 active:translate-y-1 active:shadow-none uppercase tracking-widest"
              >
                Join the vibe
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-pink-200"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-pink-50 px-2 text-pink-300 font-black">OR</span></div>
            </div>

            <button 
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white border-4 border-pink-200 py-4 rounded-2xl font-black text-pink-600 hover:bg-pink-100 transition-all"
            >
              <LogIn className="w-5 h-5" />
              Sign in as Admin
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pink-50 relative overflow-hidden font-sans selection:bg-pink-200">
      {/* Decorative Grid and Blobs */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-pink-200/30 blur-[100px] rounded-full animate-pulse pointer-events-none" />
      <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-indigo-200/30 blur-[100px] rounded-full animate-pulse delay-1000 pointer-events-none" />
      
      {/* Header */}
      {/* Dynamic Island Header */}
      <header className="fixed top-6 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-2xl transition-all duration-500">
        <div className="bg-white/80 backdrop-blur-2xl px-8 py-4 rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.1)] border border-white/20 flex items-center justify-between group">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-10 h-10 bg-indigo-950 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110">
              <Sparkles className="w-5 h-5 fill-white" />
            </div>
            <h1 className="text-2xl font-black tracking-[-0.05em] text-indigo-950 italic">VIBEILY</h1>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
               onClick={handleInstallClick}
               className={cn(
                 "p-2 rounded-full transition-all flex items-center justify-center",
                 isInstallable 
                   ? "bg-green-500 hover:bg-green-600 text-white animate-bounce" 
                   : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"
               )}
               title="Install Android / iOS App"
             >
               <Download className="w-4 h-4" />
             </button>
             <button 
               onClick={() => setIsQRPortalOpen(true)}
               className="p-2 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-colors text-indigo-600"
               title="QR Portal"
             >
               <QrCode className="w-4 h-4" />
             </button>
             <button 
               onClick={() => setIsIdentifying(true)}
               className="text-[10px] font-black text-indigo-950 uppercase tracking-[2px] bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100 transition-all font-mono"
             >
               {userName}
             </button>
             <button 
               onClick={copyVaultLink}
               className="p-2 bg-pink-50 hover:bg-pink-100 rounded-full transition-colors text-pink-600"
             >
               <Share2 className="w-4 h-4" />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-32 pb-40">
        <div className="mb-12 flex flex-wrap items-center justify-center gap-4">
            <button 
              onClick={() => setViewMode(prev => prev === 'grid' ? 'timeline' : 'grid')}
              className="p-2.5 bg-white border-2 border-indigo-950 rounded-2xl shadow-neo hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-2 text-indigo-950"
              title={viewMode === 'grid' ? "Switch to Timeline" : "Switch to Grid"}
            >
              {viewMode === 'grid' ? <Calendar className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
              <span className="text-[10px] font-black uppercase tracking-widest">
                {viewMode === 'grid' ? 'Timeline' : 'Grid'}
              </span>
            </button>
            <button 
              onClick={() => setShowOnlyLiked(prev => !prev)}
              className={cn(
                "p-2.5 border-2 border-indigo-950 rounded-2xl shadow-neo hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-2",
                showOnlyLiked ? "bg-pink-500 text-white" : "bg-white text-indigo-950"
              )}
            >
              <Heart className={cn("w-5 h-5", showOnlyLiked && "fill-current")} />
              <span className="text-[10px] font-black uppercase tracking-widest">Liked</span>
            </button>
            <button 
              onClick={() => setShowOnlyBookmarked(prev => !prev)}
              className={cn(
                "p-2.5 border-2 border-indigo-950 rounded-2xl shadow-neo hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all flex items-center gap-2",
                showOnlyBookmarked ? "bg-indigo-600 text-white" : "bg-white text-indigo-950"
              )}
            >
              <Bookmark className={cn("w-5 h-5", showOnlyBookmarked && "fill-current")} />
              <span className="text-[10px] font-black uppercase tracking-widest">Saved</span>
            </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center space-y-8">
            <motion.div 
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 3 }}
              className="w-40 h-40 bg-white border-4 border-indigo-950 rounded-[40px] shadow-neo-indigo flex items-center justify-center"
            >
              <ImageIcon className="w-16 h-16 text-pink-500" />
            </motion.div>
            <div className="space-y-4">
              <h2 className="text-5xl font-black text-indigo-950 tracking-[-0.05em] lowercase px-4">the box is empty</h2>
              <p className="text-indigo-400/80 max-w-sm mx-auto font-bold text-lg leading-relaxed">
                Connect your memories. Share the barcode with your favorite humans!
              </p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredItems.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <VibeCard 
                      item={item} 
                      onEdit={startRemix} 
                      onView={setViewingItem}
                      onShareVault={setSharingItem}
                      onToggleLike={() => handleToggleLike(item)}
                      onToggleBookmark={() => handleToggleBookmark(item)}
                      onDelete={confirmDelete}
                      isOwner={isAdmin || item.senderEmail === user?.email}
                      currentUserEmail={user?.email || userName}
                    />
                  </motion.div>
                ))}
              </div>
        ) : (
          <div className="relative max-w-3xl mx-auto py-12">
            {/* Timeline Line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-1.5 bg-indigo-950 -translate-x-1/2 hidden md:block" />
            
            <div className="space-y-24">
              {filteredItems.map((item, index) => (
                <div key={item.id} className={cn(
                  "relative flex flex-col md:flex-row items-center gap-8",
                  index % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                )}>
                  {/* Timeline Dot */}
                  <div className="absolute left-1/2 -translate-x-1/2 w-8 h-8 bg-pink-500 border-4 border-indigo-950 rounded-full z-10 hidden md:block shadow-neo-pink" />
                  
                  {/* Content Container */}
                  <motion.div 
                    initial={{ opacity: 0, x: index % 2 === 0 ? -100 : 100 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    className={cn(
                      "w-full md:w-[45%] group",
                      index % 2 === 0 ? "md:text-right" : "md:text-left"
                    )}
                  >
                    <div className={cn(
                      "mb-4 flex flex-col",
                      index % 2 === 0 ? "md:items-end" : "md:items-start"
                    )}>
                      <span className="bg-white border-2 border-indigo-950 px-4 py-1 rounded-full text-xs font-black text-indigo-950 shadow-neo">
                        {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    
                    <VibeCard 
                      item={item} 
                      onEdit={startRemix} 
                      onView={setViewingItem}
                      onShareVault={setSharingItem}
                      onToggleLike={() => handleToggleLike(item)}
                      onToggleBookmark={() => handleToggleBookmark(item)}
                      onDelete={confirmDelete}
                      isOwner={isAdmin || item.senderEmail === user?.email}
                      currentUserEmail={user?.email || userName}
                    />
                  </motion.div>
                  
                  {/* Spacer for MD */}
                  <div className="hidden md:block w-[45%]" />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Legal Footer */}
      <footer className="mt-20 mb-40 px-6 text-center opacity-40">
        <div className="max-w-2xl mx-auto space-y-4">
          <p className="text-[10px] font-black text-indigo-900 uppercase tracking-[2px]">
            DUNS: 749068766
          </p>
          <p className="text-[9px] font-bold text-indigo-800 leading-relaxed max-w-lg mx-auto">
            © 2026 JustBeYou. All Rights Reserved. VIBEILY and associated logos are trademarks of JustBeYou. 
            Licensed for digital expression and content synchronization. Unauthorized duplication, 
            reverse engineering, or distribution of proprietary vibe-sharing algorithms is strictly prohibited.
          </p>
        </div>
      </footer>

      {/* Sticky Footer Bar (Native iOS Dock Style) */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
        <footer className="flex items-center justify-between bg-white/80 backdrop-blur-2xl rounded-[32px] py-3 px-8 shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/20">
          <button 
            onClick={() => {
              setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              triggerHaptic(25);
            }}
            className="flex flex-col items-center gap-1 group"
          >
            <div className="p-2 rounded-xl group-hover:bg-indigo-50 transition-colors">
              <span className="text-xl">📊</span>
            </div>
          </button>
          
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="w-14 h-14 bg-indigo-950 rounded-2xl flex items-center justify-center text-white shadow-neo translate-y-[-24px] hover:scale-110 active:scale-95 transition-all"
          >
            <Plus className="w-8 h-8 stroke-[3px]" />
          </button>

          <button 
            className="flex flex-col items-center gap-1 group"
            onClick={() => setIsQRPortalOpen(true)}
          >
            <div className="p-2 rounded-xl group-hover:bg-pink-50 transition-colors">
              <span className="text-xl">📱</span>
            </div>
          </button>
        </footer>
      </div>

      {/* QR Code Portal / Share Modal */}
      <AnimatePresence>
        {isQRPortalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsQRPortalOpen(false)}
              className="absolute inset-0 bg-pink-900/60 backdrop-blur-sm"
            />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative bg-white border-b-[8px] border-r-[8px] border-pink-500 rounded-[40px] p-10 max-w-2xl w-full text-center shadow-2xl">
              <button onClick={() => setIsQRPortalOpen(false)} className="absolute top-6 right-6 p-2 hover:bg-pink-50 rounded-xl"><X className="w-6 h-6 text-pink-400" /></button>
              <div className="space-y-8">
                <div>
                  <h3 className="text-3xl font-black tracking-tighter text-indigo-900 lowercase">vibeily barcodes</h3>
                  <p className="text-pink-400 font-bold mt-1 uppercase tracking-widest text-xs">Different ways to enter the box</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* View Only */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Scan to View</p>
                    <div className="p-6 bg-indigo-50 rounded-[32px] border-4 border-dashed border-indigo-100 inline-block">
                      <div className="bg-white p-4 rounded-2xl shadow-inner border border-indigo-50">
                        <QRCodeSVG value={currentUrl} size={150} level="H" includeMargin={false} />
                      </div>
                    </div>
                  </div>

                  {/* Fast Upload */}
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest">Scan to Upload</p>
                    <div className="p-6 bg-pink-50 rounded-[32px] border-4 border-dashed border-pink-200 inline-block">
                      <div className="bg-white p-4 rounded-2xl shadow-inner border border-pink-100">
                        <QRCodeSVG value={`${currentUrl}&action=upload`} size={150} level="H" includeMargin={false} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-center">
                  <p className="text-[10px] text-pink-300 uppercase tracking-[4px] font-black">Link</p>
                  <div className="bg-pink-50 p-4 rounded-2xl text-xs font-black break-all text-pink-600 border-2 border-pink-100 uppercase overflow-hidden">{currentUrl}</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button onClick={() => navigator.clipboard.writeText(currentUrl)} className="w-full flex items-center justify-center gap-2 bg-indigo-950 hover:bg-indigo-900 text-white py-4 rounded-2xl transition-all font-black uppercase tracking-widest text-xs"><Share2 className="w-4 h-4" />Copy Link</button>
                  <button onClick={() => navigator.clipboard.writeText(`${currentUrl}&action=upload`)} className="w-full flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-400 text-white py-4 rounded-2xl transition-all font-black uppercase tracking-widest text-xs"><Plus className="w-4 h-4 stroke-[3px]" />Copy Upload URL</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsUploadOpen(false)}
              className="absolute inset-0 bg-indigo-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 100 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 100 }} 
              className="relative bg-white border-[6px] border-indigo-950 rounded-[40px] p-8 max-w-2xl w-full shadow-neo-lg h-full md:h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-950 rounded-2xl flex items-center justify-center text-white shadow-neo"><Plus className="w-7 h-7 stroke-[4px]" /></div>
                  <h3 className="text-4xl font-black text-indigo-950 lowercase tracking-[-0.05em]">{editingItem ? 'remix vibe' : 'add a vibe'}</h3>
                </div>
                <button 
                  onClick={() => setIsUploadOpen(false)} 
                  className="p-3 bg-pink-50 hover:bg-pink-100 rounded-2xl border-2 border-indigo-950 transition-colors"
                >
                  <X className="w-6 h-6 text-indigo-950" />
                </button>
              </div>
              
              <div className="space-y-8">
                {!editingItem && (
                  <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    {(['video', 'image', 'emotion', 'ai-video', 'ai-image', 'code'] as any[]).map((t) => (
                      <button key={t} onClick={() => setSelectedType(t as any)} className={cn("flex flex-col items-center justify-center gap-2 p-3 rounded-2xl transition-all border-4", selectedType === t ? "bg-indigo-500 border-indigo-700 text-white shadow-[4px_4px_0px_0px_rgba(55,48,163,1)]" : "bg-white border-indigo-50 text-indigo-400 hover:border-indigo-100")}>
                        {t === 'video' ? <Video className="w-5 h-5" /> : 
                         t === 'image' ? <ImageIcon className="w-5 h-5" /> : 
                         t === 'emotion' ? <Heart className="w-5 h-5" /> : 
                         t === 'ai-video' ? <Video className="w-5 h-5 text-pink-400" /> :
                         t === 'ai-image' ? <ImageIcon className="w-5 h-5 text-pink-400" /> :
                         <Code2 className="w-5 h-5 text-blue-400" />}
                        <span className="text-[9px] font-black uppercase tracking-widest">
                          {t === 'ai-video' ? 'AI Video' : t === 'ai-image' ? 'AI Image' : t}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                  {selectedType === ('ai-image' as any) && (
                    <div className="space-y-6 bg-pink-50 p-6 rounded-[32px] border-4 border-pink-100">
                      <div className="space-y-4">
                        <label className="text-[10px] text-pink-400 uppercase tracking-[4px] font-black italic">IMAGE DREAMER (IMAGEN)</label>
                        <textarea 
                          value={aiImagePrompt} 
                          onChange={(e) => setAiImagePrompt(e.target.value)} 
                          placeholder="A surreal landscape with floating islands and neon waterfalls..." 
                          className="w-full bg-white border-4 border-pink-200 rounded-[24px] p-6 outline-none focus:border-pink-400 transition-all min-h-[120px] resize-none font-bold text-pink-900 placeholder-pink-200" 
                        />
                      </div>
                      
                      {!hasApiKey ? (
                        <button 
                          onClick={handleGenerateImage}
                          className="w-full bg-indigo-950 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-neo flex items-center justify-center gap-2 hover:bg-indigo-900 transition-all"
                        >
                          <LogIn className="w-5 h-5" />
                          Link paid API Key to start
                        </button>
                      ) : (
                        <button 
                          onClick={handleGenerateImage}
                          disabled={isGeneratingImage || !aiImagePrompt.trim()}
                          className="w-full bg-indigo-950 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-neo flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-indigo-900 transition-all"
                        >
                          {isGeneratingImage ? (
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>{generationProgress}</span>
                            </div>
                          ) : (
                            <>
                              <ImageIcon className="w-5 h-5 stroke-[3px]" />
                              Generate Design
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {selectedType === ('ai-video' as any) ? (
                    <div className="space-y-6 bg-indigo-50 p-6 rounded-[32px] border-4 border-indigo-100">
                      <div className="space-y-4">
                        <label className="text-[10px] text-indigo-400 uppercase tracking-[4px] font-black italic">VIDEO DREAMER (VEO)</label>
                        <textarea 
                          value={aiPrompt} 
                          onChange={(e) => setAiPrompt(e.target.value)} 
                          placeholder="A vintage film of a sunset over a digital ocean, 4k, cinematic..." 
                          className="w-full bg-white border-4 border-indigo-200 rounded-[24px] p-6 outline-none focus:border-indigo-400 transition-all min-h-[120px] resize-none font-bold text-indigo-900 placeholder-indigo-200" 
                        />
                      </div>
                      
                      {!hasApiKey ? (
                        <button 
                          onClick={handleGenerateVideo}
                          className="w-full bg-indigo-950 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-neo flex items-center justify-center gap-2 hover:bg-indigo-900 transition-all"
                        >
                          <LogIn className="w-5 h-5" />
                          Link paid API Key to start
                        </button>
                      ) : (
                        <button 
                          onClick={handleGenerateVideo}
                          disabled={isGeneratingVideo || !aiPrompt.trim()}
                          className="w-full bg-indigo-950 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-neo flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-indigo-900 transition-all"
                        >
                          {isGeneratingVideo ? (
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              <span>{generationProgress}</span>
                            </div>
                          ) : (
                            <>
                              <Send className="w-5 h-5 stroke-[3px]" />
                              Generate Vibe Video
                            </>
                          )}
                        </button>
                      )}
                      <p className="text-[10px] text-indigo-300 font-bold text-center px-4">
                        Powered by Veo. Generation can take up to 2-3 minutes. 
                        Requires a paid billing key.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <label className="text-[10px] text-indigo-300 uppercase tracking-[4px] font-black italic">
                        {selectedType === 'emotion' ? 'Express yourself' : 'DROP THE LINK OR UPLOAD'}
                      </label>
                      
                      {selectedType !== 'emotion' && (
                        <div className="flex flex-col gap-4">
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full bg-white border-4 border-dashed border-indigo-200 py-8 rounded-[32px] flex flex-col items-center justify-center gap-2 hover:border-indigo-400 transition-all text-indigo-300 hover:text-indigo-500"
                          >
                            <Plus className="w-8 h-8" />
                            <span className="font-black uppercase tracking-widest text-xs">
                              {selectedFiles.length > 0 ? `${selectedFiles.length} files selected` : 'Choose from Camera Roll'}
                            </span>
                          </button>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            className="hidden" 
                            multiple
                            onChange={handleFileChange}
                            accept={selectedType === 'video' ? 'video/*' : 'image/*'}
                          />
                          <div className="relative flex justify-center text-[10px] uppercase"><span className="bg-white px-4 text-indigo-200 font-black">OR PASTE URL BELOW</span></div>
                        </div>
                      )}

                        <textarea 
                          value={newVibeContent} 
                          onChange={(e) => setNewVibeContent(e.target.value)} 
                          placeholder={selectedType === 'emotion' ? "What's the vibe?" : selectedType === 'code' ? "Paste your SwiftUI, React, or CSS code here..." : "Paste a URL manually..."} 
                          className={cn(
                            "w-full border-4 rounded-[32px] p-6 outline-none transition-all min-h-[140px] resize-none font-bold placeholder-indigo-200",
                            selectedType === 'code' ? "bg-slate-900 text-teal-400 font-mono border-slate-800" : "bg-indigo-50 border-indigo-100 text-indigo-900"
                          )}
                        />
                    </div>
                  )}

                {selectedType === 'emotion' && (
                  <div className="space-y-4">
                    <label className="text-[10px] text-indigo-300 uppercase tracking-[4px] font-black italic">Pick an emoji</label>
                    <div className="flex flex-wrap gap-2 p-4 bg-pink-50 rounded-[32px] border-4 border-pink-100">
                      {EMOJI_LIST.map((emo) => (
                        <button
                          key={emo}
                          onClick={() => setSelectedEmoji(emo)}
                          className={cn(
                            "w-12 h-12 flex items-center justify-center text-2xl rounded-xl transition-all hover:scale-110",
                            selectedEmoji === emo ? "bg-white shadow-lg scale-110 border-2 border-pink-200" : "opacity-50 hover:opacity-100"
                          )}
                        >
                          {emo}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleAddVibe} disabled={isUploading || (!newVibeContent.trim() && selectedFiles.length === 0)} className="w-full bg-indigo-950 hover:bg-indigo-900 disabled:opacity-50 py-5 rounded-3xl font-black text-white text-xl uppercase tracking-widest shadow-neo-lg active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-3 mt-4 border-2 border-indigo-950">
                  {isUploading ? <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-6 h-6 stroke-[3px]" />{editingItem ? 'REMIX & SAVE' : 'dropit'}</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Viewer Modal */}
      <AnimatePresence>
        {viewingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingItem(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl w-full h-full md:h-auto flex flex-col items-center justify-center pointer-events-none"
            >
              <button 
                onClick={() => setViewingItem(null)}
                className="absolute -top-12 right-0 md:-right-12 p-3 text-white/60 hover:text-white transition-colors pointer-events-auto"
              >
                <X className="w-10 h-10" />
              </button>
              
              <div className="w-full bg-white/5 rounded-[40px] overflow-hidden border-4 border-white/10 pointer-events-auto flex flex-col md:flex-row">
                <div className="flex-1 bg-black flex items-center justify-center min-h-[300px]">
                  {viewingItem.type === 'video' && viewingItem.url && (
                    <div className="relative w-full h-full flex items-center justify-center bg-indigo-950/20">
                      <video 
                        src={viewingItem.url} 
                        className="max-h-[70vh] w-full shadow-2xl" 
                        controls 
                        autoPlay 
                        loop 
                        playsInline
                      />
                    </div>
                  )}
                  {viewingItem.type === 'image' && viewingItem.url && (
                    <img src={viewingItem.url} alt="Vibe" className="max-h-[70vh] w-full object-contain" />
                  )}
                  {viewingItem.type === 'emotion' && (
                    <div className="p-12 text-center">
                      <div className="text-9xl mb-8">{viewingItem.emoji || "✨"}</div>
                      <p className="text-3xl font-black text-white leading-tight italic">"{viewingItem.content}"</p>
                    </div>
                  )}
                  {(viewingItem.type as any) === 'code' && (
                    <div className="w-full h-full p-8 bg-slate-950/50 flex flex-col font-mono text-teal-400 overflow-auto">
                       <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
                          <div className="w-3 h-3 rounded-full bg-red-400" />
                          <div className="w-3 h-3 rounded-full bg-yellow-400" />
                          <div className="w-3 h-3 rounded-full bg-green-400" />
                          <span className="ml-4 text-[10px] text-white/40 uppercase tracking-widest">vibe_snippet.swift</span>
                       </div>
                       <pre className="text-sm md:text-base leading-relaxed">
                         <code>{viewingItem.content}</code>
                       </pre>
                    </div>
                  )}
                </div>
                
                <div className="w-full md:w-80 bg-white p-8 flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center text-white font-black text-xl shadow-lg">
                      {viewingItem.senderName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-black text-indigo-900 uppercase tracking-tighter text-xl">{viewingItem.senderName}</p>
                      <p className="text-pink-400 text-[10px] font-black uppercase tracking-widest">Shared this memory</p>
                    </div>
                  </div>
                  
                  {viewingItem.emotion && (
                     <div className="bg-pink-50 px-4 py-2 rounded-xl mb-6">
                        <p className="text-[10px] text-pink-300 font-black uppercase tracking-widest mb-1">Detected Vibe</p>
                        <p className="text-pink-600 font-black">#{viewingItem.emotion}</p>
                     </div>
                  )}
                  
                  <div className="flex flex-col gap-3 mt-8">
                     <button 
                       onClick={() => { setViewingItem(null); startRemix(viewingItem); }}
                       className="w-full bg-yellow-400 hover:bg-yellow-300 text-indigo-950 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-neo shadow-yellow-600 active:translate-x-1 active:translate-y-1 active:shadow-none border-2 border-indigo-950"
                     >
                       Remix
                     </button>
                     {(isAdmin || viewingItem.senderEmail === user?.email) && (
                       <button 
                         onClick={() => { confirmDelete(viewingItem); }}
                         className="w-full bg-red-100 hover:bg-red-200 text-red-600 py-3 rounded-2xl font-black uppercase tracking-widest transition-all border-2 border-red-200"
                       >
                         Remove
                       </button>
                     )}
                  </div>

                  <div className="mt-8 pt-8 border-t border-indigo-50">
                    <p className="text-[10px] text-pink-300 font-black uppercase tracking-widest mb-4 text-center">Share this memory</p>
                    <div className="flex flex-col items-center gap-6">
                      <div className="p-4 bg-white rounded-2xl border-2 border-pink-100 shadow-sm">
                        <QRCodeSVG 
                          value={`${window.location.origin}${window.location.pathname}?v=${vaultId}&item=${viewingItem.id}`}
                          size={120}
                          level="H"
                        />
                      </div>

                      <div className="flex flex-wrap justify-center gap-3 w-full">
                        <button 
                          onClick={() => {
                            const url = `${window.location.origin}${window.location.pathname}?v=${vaultId}&item=${viewingItem.id}`;
                            const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                            window.open(fbUrl, '_blank');
                          }}
                          className="p-3 bg-blue-600 text-white rounded-xl hover:scale-110 transition-transform shadow-lg"
                          title="Share on Facebook"
                        >
                          <Facebook className="w-5 h-5 fill-current" />
                        </button>

                        <button 
                          onClick={() => {
                            const url = `${window.location.origin}${window.location.pathname}?v=${vaultId}&item=${viewingItem.id}`;
                            const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(`Check out this vibe: ${url}`)}`;
                            window.open(threadsUrl, '_blank');
                          }}
                          className="p-3 bg-black text-white rounded-xl hover:scale-110 transition-transform shadow-lg"
                          title="Share on Threads"
                        >
                          <AtSign className="w-5 h-5" />
                        </button>

                        <button 
                          onClick={() => {
                            const url = `${window.location.origin}${window.location.pathname}?v=${vaultId}&item=${viewingItem.id}`;
                            const smsUrl = `sms:?&body=${encodeURIComponent(`Check out this vibe on VIBEILY: ${url}`)}`;
                            window.location.href = smsUrl;
                          }}
                          className="p-3 bg-green-500 text-white rounded-xl hover:scale-110 transition-transform shadow-lg"
                          title="Share via SMS"
                        >
                          <MessageSquare className="w-5 h-5" />
                        </button>

                        {navigator.share && (
                          <button 
                            onClick={() => {
                              const url = `${window.location.origin}${window.location.pathname}?v=${vaultId}&item=${viewingItem.id}`;
                              navigator.share({
                                title: 'VIBEILY - Shared Memory',
                                text: 'Check out this memory on VIBEILY!',
                                url: url
                              }).catch(() => {});
                            }}
                            className="p-3 bg-indigo-500 text-white rounded-xl hover:scale-110 transition-transform shadow-lg"
                            title="More Share Options"
                          >
                            <Share2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>

                      <button 
                        onClick={() => {
                          const url = `${window.location.origin}${window.location.pathname}?v=${vaultId}&item=${viewingItem.id}`;
                          navigator.clipboard.writeText(url);
                          alert('Individual vibe link copied!');
                        }}
                        className="w-full bg-pink-50 hover:bg-pink-100 text-pink-600 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Vault Share Modal */}
      <AnimatePresence>
        {sharingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSharingItem(null)}
              className="absolute inset-0 bg-indigo-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white border-[6px] border-indigo-950 rounded-[40px] p-8 max-w-sm w-full shadow-neo-lg"
            >
              <button 
                onClick={() => setSharingItem(null)} 
                className="absolute top-6 right-6 p-2 hover:bg-pink-50 rounded-xl"
              >
                <X className="w-6 h-6 text-indigo-300" />
              </button>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-black text-indigo-950 lowercase tracking-tight">Share with friends</h3>
                  <p className="text-indigo-400 font-bold text-xs uppercase tracking-widest mt-1">Select friends from this box</p>
                </div>
                
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {friends.length === 0 ? (
                    <div className="py-8 text-center bg-indigo-50 rounded-2xl border-2 border-dashed border-indigo-100">
                      <p className="text-indigo-300 font-bold text-xs uppercase italic">No other friends found yet</p>
                    </div>
                  ) : (
                    friends.map((friend) => {
                      const isShared = (items.find(i => i.id === sharingItem.id)?.sharedWithEmails || []).includes(friend.email || '');
                      return (
                        <button
                          key={friend.email || friend.name}
                          onClick={() => friend.email && handleShareWithFriend(friend.email)}
                          disabled={!friend.email || isShared}
                          className={cn(
                            "w-full flex items-center justify-between p-4 rounded-2xl border-4 transition-all group",
                            isShared 
                              ? "bg-green-50 border-green-200 opacity-50"
                              : "bg-white border-indigo-50 hover:border-indigo-200"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-500 font-black">
                              {friend.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-left">
                              <p className="font-black text-indigo-900 uppercase tracking-tighter text-sm">{friend.name}</p>
                              <p className="text-indigo-300 text-[9px] font-bold truncate max-w-[120px]">{friend.email || 'No email'}</p>
                            </div>
                          </div>
                          {isShared ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          ) : (
                            friend.email && <Plus className="w-5 h-5 text-indigo-200 group-hover:text-indigo-500 transition-colors" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
                
                <button 
                  onClick={() => setSharingItem(null)}
                  className="w-full bg-indigo-950 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-neo transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PWA Android & iOS Installation Guide Modal */}
      <AnimatePresence>
        {showInstallGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInstallGuide(false)}
              className="absolute inset-0 bg-indigo-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white border-[6px] border-indigo-950 rounded-[40px] p-8 max-w-md w-full shadow-neo-lg text-indigo-950"
            >
              <button 
                onClick={() => setShowInstallGuide(false)} 
                className="absolute top-6 right-6 p-2 hover:bg-pink-50 rounded-xl"
              >
                <X className="w-6 h-6 text-indigo-300" />
              </button>
              
              <div className="space-y-6">
                <div>
                  <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg">
                    <Download className="w-6 h-6" />
                  </div>
                  <h3 className="text-2xl font-black italic uppercase tracking-tight text-indigo-950">Install Vibeily App</h3>
                  <p className="text-indigo-400 font-bold text-xs uppercase tracking-widest mt-1">Add to your home screen for quick family sharing</p>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-indigo-50 rounded-2xl border-2 border-indigo-100 flex gap-4">
                    <div className="w-8 h-8 bg-indigo-950 text-white rounded-full flex items-center justify-center font-black flex-shrink-0 text-sm">🤖</div>
                    <div>
                      <p className="font-black text-sm uppercase tracking-tight text-indigo-900">On Android / Chrome</p>
                      <p className="text-xs font-bold text-indigo-600 mt-0.5">Tap the menu button (three vertical dots) and choose "Install App" or "Add to Home Screen".</p>
                    </div>
                  </div>

                  <div className="p-4 bg-pink-50 rounded-2xl border-2 border-pink-100 flex gap-4">
                    <div className="w-8 h-8 bg-pink-500 text-white rounded-full flex items-center justify-center font-black flex-shrink-0 text-sm">🍎</div>
                    <div>
                      <p className="font-black text-sm uppercase tracking-tight text-pink-900">On iOS / Safari</p>
                      <p className="text-xs font-bold text-pink-600 mt-0.5">Tap the Share icon (square with arrow up) in Safari and choose "Add to Home Screen".</p>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={() => setShowInstallGuide(false)}
                  className="w-full bg-indigo-950 hover:bg-indigo-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-neo transition-all active:translate-x-1 active:translate-y-1 active:shadow-none"
                >
                  Awesome, got it!
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deluxe Vibe Removal Confirmation Dialog */}
      <AnimatePresence>
        {itemToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setItemToDelete(null)}
              className="absolute inset-0 bg-red-950/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-white border-[6px] border-indigo-950 rounded-[45px] p-8 max-w-sm w-full shadow-[0_20px_50px_rgba(239,68,68,0.2)] text-indigo-950 text-center"
            >
              <div className="w-20 h-20 bg-red-500 rounded-[30px] flex items-center justify-center text-white mx-auto mb-6 shadow-neo-pink border-4 border-indigo-950 animate-pulse text-3xl">
                ⚠️
              </div>
              
              <h3 className="text-3xl font-black italic tracking-tighter text-indigo-950 uppercase">Are you sure?</h3>
              <p className="text-indigo-400 font-bold text-xs uppercase tracking-widest mt-1 mb-4">Immediate Removal requested</p>

              <p className="text-sm font-bold text-indigo-900 leading-relaxed max-w-xs mx-auto mb-8">
                You are about to permanently slice this beautiful <span className="text-red-500 font-black underline uppercase">{itemToDelete.type}</span> memory from the collection. There is no turning back!
              </p>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={executeDelete}
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-neo shadow-red-700 hover:shadow-none border-2 border-indigo-950 transition-all active:translate-x-1 active:translate-y-1"
                >
                  Yes, Remove It!
                </button>
                <button 
                  onClick={() => {
                    triggerHaptic(15);
                    setItemToDelete(null);
                  }}
                  className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-950 py-4 rounded-2xl font-black uppercase tracking-widest border-2 border-indigo-950 transition-all"
                >
                  No, Keep It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
