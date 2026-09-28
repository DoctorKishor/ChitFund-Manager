'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 'admin' | 'manager' | 'subscriber';

export interface Profile {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
}

interface SimulationContextType {
  currentUser: Profile;
  simulatedUser: Profile;
  testProfiles: Profile[];
  switchSimulatedUser: (id: string) => void;
}

const CURRENT_ADMIN: Profile = {
  id: 'admin-kishor-id',
  fullName: 'Kishor (Admin)',
  phoneNumber: '+91 98765 43210',
  role: 'admin',
};

const TEST_PROFILES: Profile[] = [
  CURRENT_ADMIN,
  {
    id: 'manager-dad-id',
    fullName: 'Ramesh (Dad / Manager)',
    phoneNumber: '+91 98765 43211',
    role: 'manager',
  },
  {
    id: 'manager-mom-id',
    fullName: 'Geetha (Mom / Manager)',
    phoneNumber: '+91 98765 43212',
    role: 'manager',
  },
  {
    id: 'sub-priya-id',
    fullName: 'Priya Subramanian (Subscriber)',
    phoneNumber: '+91 98765 43213',
    role: 'subscriber',
  },
  {
    id: 'sub-balaji-id',
    fullName: 'Balaji Srinivasan (Subscriber)',
    phoneNumber: '+91 98765 43214',
    role: 'subscriber',
  },
];

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider = ({ children }: { children: ReactNode }) => {
  const [simulatedUser, setSimulatedUser] = useState<Profile>(CURRENT_ADMIN);

  const switchSimulatedUser = (id: string) => {
    const profile = TEST_PROFILES.find((p) => p.id === id);
    if (profile) {
      setSimulatedUser(profile);
    }
  };

  return (
    <SimulationContext.Provider
      value={{
        currentUser: CURRENT_ADMIN,
        simulatedUser,
        testProfiles: TEST_PROFILES,
        switchSimulatedUser,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
};

export const useSimulation = () => {
  const context = useContext(SimulationContext);
  if (!context) {
    throw new Error('useSimulation must be used within a SimulationProvider');
  }
  return context;
};
