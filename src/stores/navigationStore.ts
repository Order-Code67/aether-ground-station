import { create } from "zustand";
import type { ModuleId, NavSectionId } from "@/types";
import {
  defaultModuleForSection,
  sectionForModule,
  tabsForSection,
} from "@/types/navigation";

interface NavigationState {
  activeSection: NavSectionId;
  activeModule: ModuleId;
  /** Show Advanced tabs under Settings (and other sections that define them). */
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  setSection: (id: NavSectionId) => void;
  /** Switch tab while staying in the current section when possible. */
  setModuleInSection: (id: ModuleId) => void;
  /** Deep-link / quick action: jump to canonical section for module. */
  navigateToModule: (id: ModuleId) => void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  activeSection: "home",
  activeModule: "home",
  showAdvanced: false,
  setShowAdvanced: (v) => set({ showAdvanced: v }),
  setSection: (id) =>
    set({
      activeSection: id,
      activeModule: defaultModuleForSection(id),
    }),
  setModuleInSection: (id) => {
    const { activeSection, showAdvanced } = get();
    const allowed = tabsForSection(activeSection, {
      includeAdvanced: showAdvanced || activeSection === "settings",
    });
    if (allowed.includes(id)) {
      set({ activeModule: id });
      return;
    }
    set({
      activeSection: sectionForModule(id),
      activeModule: id,
    });
  },
  navigateToModule: (id) =>
    set({
      activeSection: sectionForModule(id),
      activeModule: id,
    }),
}));
