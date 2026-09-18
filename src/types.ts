export type VibeType = 'video' | 'image' | 'emotion';

export interface VibeItem {
  id: string;
  type: VibeType;
  url?: string;
  content?: string; 
  emotion?: string; 
  createdAt: number;
  senderName: string;
  senderEmail?: string;
  vaultId: string;
  emoji?: string;
  originalVibeId?: string;
  isRemix?: boolean;
  sharedWithEmails?: string[];
  likes?: string[];
  bookmarks?: string[];
}

export interface Vault {
  id: string;
  name: string;
  ownerId: string;
  items: VibeItem[];
}
