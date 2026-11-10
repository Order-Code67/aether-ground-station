import { create } from "zustand";

export interface ArchiveClip {
  id: string;
  title: string;
  startedAt: string;
  endedAt?: string;
  source: string;
  sizeBytes: number;
  /** Object URL for in-session playback; may be lost after restart */
  objectUrl?: string;
  mimeType?: string;
  filePath?: string;
}

interface ArchiveState {
  clips: ArchiveClip[];
  storageFolder: string;
  hydrated: boolean;
  addClip: (clip: ArchiveClip) => void;
  removeClip: (id: string) => void;
  setStorageFolder: (folder: string) => void;
  hydrate: (clips: ArchiveClip[], storageFolder: string) => void;
}

/** Persistence: SQLite via useSqliteSync (SSOT). No localStorage dual-write. */
export const useArchiveStore = create<ArchiveState>((set) => ({
  clips: [],
  storageFolder: "",
  hydrated: false,
  addClip: (clip) => set((s) => ({ clips: [clip, ...s.clips] })),
  removeClip: (id) =>
    set((s) => {
      const clip = s.clips.find((c) => c.id === id);
      if (clip?.objectUrl) URL.revokeObjectURL(clip.objectUrl);
      return { clips: s.clips.filter((c) => c.id !== id) };
    }),
  setStorageFolder: (storageFolder) => set({ storageFolder }),
  hydrate: (clips, storageFolder) =>
    set({
      clips: clips.map(({ objectUrl: _o, ...rest }) => rest),
      storageFolder,
      hydrated: true,
    }),
}));
