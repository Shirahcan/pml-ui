'use client';

import { settingName } from '../../language';
import { createContext, useContext, type ReactNode } from 'react';

import type { StudioParam } from '../components';

/**
 * Present only while the settings rail is editing a Studio component's OWN design (PML v2 S3). It is
 * what turns "write `{title}` in the body" into a switch: any text, link or image can be handed to
 * each page without the author ever seeing a binding. On a normal page there is no provider, so the
 * same rail shows none of this.
 */
export interface StudioAuthoring {
  params: StudioParam[];
  /**
   * Offer this value to each page. `extra` carries what the kind needs (a choice's options, a style's key).
   * Returns the setting's name for the binding.
   */
  expose: (label: string, kind: StudioParam['kind'], value: string, extra?: Partial<StudioParam>) => string;
  /** Take a setting back. The caller writes its default into the design. */
  unexpose: (name: string) => void;
  setDefault: (name: string, value: string) => void;
  /** Does the design already have a space for a page's own elements? */
  hasSlot: boolean;
}

const StudioAuthoringContext = createContext<StudioAuthoring | null>(null);

export function StudioAuthoringProvider({ value, children }: { value: StudioAuthoring; children: ReactNode }) {
  return <StudioAuthoringContext.Provider value={value}>{children}</StudioAuthoringContext.Provider>;
}

export function useStudioAuthoring(): StudioAuthoring | null {
  return useContext(StudioAuthoringContext);
}

/** The setting a prop shows (`{props.title}`, PML v3), or null for a plain value. */
export function bindingName(value: unknown): string | null {
  return settingName(value);
}
