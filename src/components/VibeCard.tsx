import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Image as ImageIcon, 
  Heart,
  Calendar,
  User,
  Edit2,
  Repeat,
  Download,
  Share2,
  Video,
  Bookmark,
  Trash2
} from 'lucide-react';
import { VibeItem } from '../types';
import { cn } from '../lib/utils';

interface VibeCardProps {
  item: VibeItem;
  onEdit?: (item: VibeItem) => void;
  onView?: (item: VibeItem) => void;
  onShareVault?: (item: VibeItem) => void;
  onToggleLike?: () => void;
  onToggleBookmark?: () => void;
  onDelete?: (item: VibeItem) => void;
  isOwner?: boolean;
  currentUserEmail?: string | null;
}

export function VibeCard({ 
  item, 
  onEdit, 
  onView, 
  onShareVault, 
  onToggleLike, 
  onToggleBookmark, 
  onDelete,
  isOwner, 
  currentUserEmail 
}: VibeCardProps) {
  const isSharedWithMe = currentUserEmail && item.sharedWithEmails?.includes(currentUserEmail);
  const isLikedByMe = currentUserEmail && item.likes?.includes(currentUserEmail);
  const isBookmarkedByMe = currentUserEmail && item.bookmarks?.includes(currentUserEmail);

  const handleShareItem = (e: React.MouseEvent) => {
    e.stopPropagation();
    const itemUrl = `${window.location.origin}${window.location.pathname}?v=${item.vaultId}&item=${item.id}`;
    if (navigator.share) {
      navigator.share({
        title: `Vibe from ${item.senderName}`,
        text: item.content || `Check out this ${item.type} memory!`,
        url: itemUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(itemUrl);
      alert('Link copied to clipboard!');
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.url) {
      window.open(item.url, '_blank');
    }
  };

  const dateStr = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });

  const getTheme = () => {
    switch (item.type) {
      case 'video': return { bg: 'bg-indigo-500', border: 'border-indigo-900', text: 'text-indigo-950', label: 'bg-indigo-900', shadow: 'shadow-neo-indigo hover:shadow-none' };
      case 'image': return { bg: 'bg-yellow-400', border: 'border-yellow-900', text: 'text-yellow-950', label: 'bg-yellow-900', shadow: 'shadow-neo-lg hover:shadow-none' };
      case 'emotion': return { bg: 'bg-orange-400', border: 'border-orange-900', text: 'text-orange-950', label: 'bg-orange-900', shadow: 'shadow-neo-lg hover:shadow-none' };
      default: return { bg: 'bg-gray-400', border: 'border-gray-900', text: 'text-gray-950', label: 'bg-gray-900', shadow: 'shadow-neo-lg hover:shadow-none' };
    }
  };

  const theme = getTheme();

  return (
    <motion.div
      layout
      id={`vibe-${item.id}`}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={() => onView?.(item)}
      className={cn(
        "group relative rounded-[40px] overflow-hidden border-[6px] flex flex-col transition-all active:translate-x-1 active:translate-y-1 active:shadow-none cursor-pointer",
        theme.bg,
        theme.border,
        theme.shadow
      )}
    >
      {/* Label Badge */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 pr-20">
        <div className={cn(
          "text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
          theme.label
        )}>
          {item.isRemix && <Repeat className="w-3 h-3" />}
          {item.type}
        </div>
        {isSharedWithMe && (
          <div className="bg-pink-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg animate-bounce">
            <Heart className="w-3 h-3 fill-white" />
            For You
          </div>
        )}
      </div>

      {/* Remix/Share/Edit Buttons */}
      <div className="absolute top-4 right-4 z-10 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
        {item.url && (
          <button 
            onClick={handleDownload}
            className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-xl backdrop-blur-md transition-all"
            title="Download/Open"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
        <button 
          onClick={handleShareItem}
          className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-xl backdrop-blur-md transition-all"
          title="Share on Social"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Like Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleLike?.(); }}
          className={cn(
            "p-2 rounded-xl transition-all shadow-lg transform hover:scale-110 active:scale-95 border-b-4",
            isLikedByMe 
              ? "bg-pink-500 border-pink-700 text-white" 
              : "bg-white/20 backdrop-blur-md border-white/40 text-white hover:bg-white/40"
          )}
          title="Like Vibe"
        >
          <Heart className={cn("w-4 h-4 stroke-[3px]", isLikedByMe && "fill-white")} />
        </button>

        {/* Bookmark Button */}
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleBookmark?.(); }}
          className={cn(
            "p-2 rounded-xl transition-all shadow-lg transform hover:scale-110 active:scale-95 border-b-4",
            isBookmarkedByMe 
              ? "bg-indigo-600 border-indigo-800 text-white" 
              : "bg-white/20 backdrop-blur-md border-white/40 text-white hover:bg-white/40"
          )}
          title="Save Vibe"
        >
          <Bookmark className={cn("w-4 h-4 stroke-[3px]", isBookmarkedByMe && "fill-white")} />
        </button>
        
        {/* Vault Share Button - Only for owner */}
        {isOwner && onShareVault && (
          <button 
            onClick={(e) => { e.stopPropagation(); onShareVault(item); }}
            className="p-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl shadow-lg transition-all transform hover:scale-110 active:scale-95 border-b-4 border-pink-700"
            title="Share with Vault Friends"
          >
            <User className="w-4 h-4 stroke-[3px]" />
          </button>
        )}

        {/* Remix Button - For everyone */}
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit?.(item); }}
          className="p-2 bg-yellow-400 hover:bg-yellow-500 text-white rounded-xl shadow-lg transition-all transform hover:scale-110 active:scale-95 border-b-4 border-yellow-600"
          title="Remix Vibe"
        >
          <Repeat className="w-4 h-4 stroke-[3px]" />
        </button>

        {/* Edit Button - Only for owner */}
        {isOwner && onEdit && (
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}
            className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl shadow-lg transition-all transform hover:scale-110 active:scale-95 border-b-4 border-indigo-700"
            title="Edit Vibe"
          >
            <Edit2 className="w-4 h-4 stroke-[3px]" />
          </button>
        )}

        {/* Delete Button - Only for owner */}
        {isOwner && onDelete && (
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(item); }}
            className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-xl shadow-lg transition-all transform hover:scale-110 active:scale-95 border-b-4 border-red-700"
            title="Remove Vibe"
          >
            <Trash2 className="w-4 h-4 stroke-[3px]" />
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="aspect-square flex items-center justify-center relative overflow-hidden bg-white/10">
        {item.type === 'video' && item.url && (
          <div className="w-full h-full relative group/vid">
            <video 
              src={item.url} 
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              muted
              loop
              onMouseOver={(e) => {
                e.currentTarget.play();
                const playIcon = e.currentTarget.parentElement?.querySelector('.play-overlay');
                if (playIcon) playIcon.classList.add('opacity-0');
              }}
              onMouseOut={(e) => {
                e.currentTarget.pause();
                const playIcon = e.currentTarget.parentElement?.querySelector('.play-overlay');
                if (playIcon) playIcon.classList.remove('opacity-0');
              }}
            />
            <div className="play-overlay absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300">
               <div className="bg-white/20 backdrop-blur-md p-4 rounded-full border-4 border-white/30 shadow-xl">
                 <Play className="w-8 h-8 fill-white text-white translate-x-0.5" />
               </div>
            </div>
            {/* Progress bar simulation for hover */}
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/20">
               <motion.div 
                 initial={{ width: 0 }}
                 whileHover={{ width: '100%' }}
                 transition={{ duration: 15, ease: "linear" }}
                 className="h-full bg-white/60"
               />
            </div>
          </div>
        )}
        {item.type === 'image' && item.url && (
          <img 
            src={item.url} 
            alt="Vibe" 
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
          />
        )}
        {item.type === 'emotion' && (
          <div className="p-8 text-center h-full w-full flex flex-col justify-center items-center">
             <div className="text-6xl mb-4 group-hover:scale-125 transition-transform drop-shadow-lg">
               {item.emoji || "✨"}
             </div>
             <p className="text-xl font-black text-white leading-tight drop-shadow-md">
               {item.content || "Pure Magic"}
             </p>
          </div>
        )}
        {(item.type as any) === 'code' && (
          <div className="w-full h-full p-4 bg-slate-900 overflow-hidden font-mono text-[10px] text-teal-400 group-hover:bg-slate-800 transition-colors">
            <div className="flex gap-1.5 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-400/50" />
              <div className="w-2 h-2 rounded-full bg-yellow-400/50" />
              <div className="w-2 h-2 rounded-full bg-green-400/50" />
            </div>
            <pre className="opacity-80 group-hover:opacity-100 transition-opacity">
              <code>{item.content?.substring(0, 500)}...</code>
            </pre>
          </div>
        )}
      </div>

      {/* Info Area */}
      <div className="p-6 mt-auto bg-white/10 backdrop-blur-sm border-t border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center border-2 border-white/40 overflow-hidden shadow-lg">
                <div className="w-full h-full bg-pink-400 flex items-center justify-center text-[10px] font-black text-white">
                  {item.senderName.substring(0, 2).toUpperCase()}
                </div>
             </div>
             <span className="text-sm font-black text-white drop-shadow-sm">{item.senderName}</span>
          </div>
          <div className="text-white/60 text-[10px] font-black uppercase tracking-widest bg-black/10 px-2 py-1 rounded-md">
            {dateStr}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function VideoIcon() { return <Video className="w-5 h-5" />; }
function PhotoIcon() { return <ImageIcon className="w-5 h-5" />; }
function EmotionIcon() { return <Heart className="w-5 h-5" />; }
