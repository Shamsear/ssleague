/**
 * Football Player Positions
 * Based on eFootball position system
 */

export const POSITIONS = {
  GK: 'GK',       // Goalkeeper
  CB: 'CB',       // Center Back
  LB: 'LB',       // Left Back
  RB: 'RB',       // Right Back
  DMF: 'DMF',     // Defensive Midfielder
  CMF: 'CMF',     // Central Midfielder
  AMF: 'AMF',     // Attacking Midfielder
  LMF: 'LMF',     // Left Midfielder
  RMF: 'RMF',     // Right Midfielder
  LWF: 'LWF',     // Left Wing Forward
  RWF: 'RWF',     // Right Wing Forward
  SS: 'SS',       // Second Striker
  CF: 'CF',       // Center Forward
} as const;

export const POSITION_LABELS = {
  GK: 'Goalkeeper',
  CB: 'Center Back',
  LB: 'Left Back',
  RB: 'Right Back',
  DMF: 'Defensive Midfielder',
  CMF: 'Central Midfielder',
  AMF: 'Attacking Midfielder',
  LMF: 'Left Midfielder',
  RMF: 'Right Midfielder',
  LWF: 'Left Wing Forward',
  RWF: 'Right Wing Forward',
  SS: 'Second Striker',
  CF: 'Center Forward',
} as const;

// Position groups for filtering and display
export const POSITION_GROUPS = {
  GK: ['GK'],
  DEF: ['CB', 'LB', 'RB'],
  MID: ['DMF', 'CMF', 'AMF', 'LMF', 'RMF'],
  FWD: ['LWF', 'RWF', 'SS', 'CF'],
} as const;

export const POSITION_GROUP_LABELS = {
  GK: 'Goalkeeper',
  DEF: 'Defenders',
  MID: 'Midfielders',
  FWD: 'Forwards',
} as const;

// Get all positions as an array
export const ALL_POSITIONS = Object.values(POSITIONS);

// Get position group for a specific position
export function getPositionGroup(position: string): string | null {
  const pos = position?.toUpperCase();
  
  for (const [group, positions] of Object.entries(POSITION_GROUPS)) {
    if ((positions as readonly string[]).includes(pos)) {
      return group;
    }
  }
  
  return null;
}

// Get color for position group
export function getPositionColor(position: string): string {
  const group = getPositionGroup(position);
  
  switch (group) {
    case 'GK':
      return 'yellow';
    case 'DEF':
      return 'blue';
    case 'MID':
      return 'green';
    case 'FWD':
      return 'red';
    default:
      return 'gray';
  }
}

// Get emoji for position group
export function getPositionEmoji(position: string): string {
  const group = getPositionGroup(position);
  
  switch (group) {
    case 'GK':
      return '🧤';
    case 'DEF':
      return '🛡️';
    case 'MID':
      return '⚙️';
    case 'FWD':
      return '⚽';
    default:
      return '👤';
  }
}
