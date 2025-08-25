// Access level utilities for question bank management

export type AccessLevel = 'read' | 'read_add' | 'write' | 'admin';

export interface AccessLevelConfig {
  value: AccessLevel;
  label: string;
  description: string;
  permissions: {
    canView: boolean;
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
    canAssignToClasses: boolean;
    canManageAccess: boolean;
  };
}

export const ACCESS_LEVELS: Record<AccessLevel, AccessLevelConfig> = {
  read: {
    value: 'read',
    label: 'Read Only',
    description: 'Can view questions and use them in tests',
    permissions: {
      canView: true,
      canAdd: false,
      canEdit: false,
      canDelete: false,
      canAssignToClasses: true,
      canManageAccess: false,
    }
  },
  read_add: {
    value: 'read_add',
    label: 'Read & Add',
    description: 'Can view and add new questions but cannot modify or delete existing ones',
    permissions: {
      canView: true,
      canAdd: true,
      canEdit: false,
      canDelete: false,
      canAssignToClasses: true,
      canManageAccess: false,
    }
  },
  write: {
    value: 'write',
    label: 'Full Access',
    description: 'Can view, add, edit, and delete questions',
    permissions: {
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: true,
      canAssignToClasses: true,
      canManageAccess: false,
    }
  },
  admin: {
    value: 'admin',
    label: 'Admin',
    description: 'Full access including managing other teachers\' access',
    permissions: {
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: true,
      canAssignToClasses: true,
      canManageAccess: true,
    }
  }
};

export const getAccessLevelConfig = (level: AccessLevel): AccessLevelConfig => {
  return ACCESS_LEVELS[level];
};

export const getAccessLevelLabel = (level: AccessLevel): string => {
  return ACCESS_LEVELS[level]?.label || level;
};

export const getAccessLevelDescription = (level: AccessLevel): string => {
  return ACCESS_LEVELS[level]?.description || level;
};

export const canPerformAction = (
  level: AccessLevel, 
  action: keyof AccessLevelConfig['permissions']
): boolean => {
  return ACCESS_LEVELS[level]?.permissions[action] || false;
};

export const getAvailableAccessLevels = (excludeAdmin = true): AccessLevelConfig[] => {
  const levels = Object.values(ACCESS_LEVELS);
  return excludeAdmin ? levels.filter(level => level.value !== 'admin') : levels;
};
