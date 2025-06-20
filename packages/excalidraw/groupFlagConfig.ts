export interface GroupFlagConfig {
  movable: boolean;
  resizable: boolean;
  active: boolean;
}

export const GROUP_FLAG_CONFIG: Record<string, GroupFlagConfig> = {
  user: { movable: true, resizable: true, active: true },
  internal: { movable: false, resizable: false, active: true },
};
