# Football Slot Management System

## Overview
Dynamic football player slot management system that allows committee admins to configure base slots and add/remove additional slots for individual teams.

## Key Concepts

### Slot Types
1. **Base Slots**: Default slots every team gets (configured at season level, default: 25)
2. **Purchased Slots**: Additional slots added by committee admin (max configurable, default: 3)
3. **Total Slots**: Base + Purchased = Total available slots for a team

### Slot Pricing
- **Price Per Slot**: eCoin cost for each additional slot (default: ₡10)
- **Max Purchasable**: Maximum additional slots a team can have (default: 3)
- **Purchase Enabled**: Toggle to enable/disable slot purchases

## Database Schema

### Firebase (team_seasons document)
```javascript
{
  // Existing fields...
  football_base_slots: 25,           // Base slots (from season settings)
  football_purchased_slots: 0,       // Additional slots purchased
  football_total_slots: 25,          // Total available (base + purchased)
  football_players_count: 20,        // Current players owned
  // Available slots = total_slots - players_count
}
```

### Firebase (seasons document)
```javascript
{
  // Existing fields...
  max_football_players: 25,                    // Legacy/base slots
  football_base_slots: 25,                     // Base slots for all teams
  football_max_purchasable_slots: 3,           // Max additional slots
  football_slot_price: 10,                     // eCoin per slot
  football_slot_purchase_enabled: true         // Enable/disable purchases
}
```

### Neon (teams table - auction database)
```sql
ALTER TABLE teams ADD COLUMN football_base_slots INTEGER DEFAULT 25;
ALTER TABLE teams ADD COLUMN football_purchased_slots INTEGER DEFAULT 0;
ALTER TABLE teams ADD COLUMN football_total_slots INTEGER DEFAULT 25;
```

### Neon (football_slot_purchases table)
```sql
CREATE TABLE football_slot_purchases (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,
  season_id VARCHAR(255) NOT NULL,
  slots_purchased INTEGER NOT NULL,
  price_per_slot DECIMAL(10, 2) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  purchased_at TIMESTAMP DEFAULT NOW(),
  purchased_by VARCHAR(255),
  notes TEXT
);
```

## API Endpoints

### 1. Get Slot Settings
```
GET /api/football-slot-settings?season_id={seasonId}
```
Returns current slot configuration for a season.

### 2. Update Slot Settings
```
POST /api/football-slot-settings
Body: {
  season_id: string,
  football_base_slots: number,
  football_max_purchasable_slots: number,
  football_slot_price: number,
  football_slot_purchase_enabled: boolean
}
```
Updates season-level slot settings (committee admin only).

### 3. Purchase Slots (Future - Team Self-Service)
```
POST /api/team/purchase-football-slots
Body: {
  team_id: string,
  season_id: string,
  slots_to_purchase: number
}
```
Allows teams to purchase additional slots (currently disabled - admin only).

## Committee Admin Pages

### 1. Football Slot Settings
**Path**: `/dashboard/committee/football-slot-settings`

Configure season-wide slot settings:
- Base slots for all teams
- Maximum purchasable slots
- Price per slot (eCoin)
- Enable/disable slot purchases

### 2. Team Slots Management
**Path**: `/dashboard/committee/team-slots`

Manage individual team slots:
- View all teams with their slot allocation
- Add slots to specific teams (+1 button)
- Remove slots from specific teams (-1 button)
- See current players vs available slots
- Search and filter teams

## Usage Flow

### Committee Admin Workflow
1. Go to **Football Slot Settings** to configure:
   - Base slots: 25 (default for all teams)
   - Max purchasable: 3 (teams can have up to 28 total)
   - Price per slot: ₡10

2. Go to **Team Slots** to manage individual teams:
   - View team: "Manchester United" has 23/25 players (2 available)
   - Click "+1" to add a slot → Team now has 23/26 (3 available)
   - Click "+1" again → Team now has 23/27 (4 available)
   - Maximum: Can add up to 3 additional slots (28 total)

### Bulk Auction Integration
When teams bid in bulk auctions:
1. System checks `football_total_slots` from team_season
2. Calculates available slots: `total_slots - current_players - pending_bids`
3. Prevents bidding if no slots available
4. Shows slot information on bulk auction page

## Key Files Modified

### Pages Created
1. `app/dashboard/committee/football-slot-settings/page.tsx` - Configure slot settings
2. `app/dashboard/committee/team-slots/page.tsx` - Manage team slots
3. `app/api/football-slot-settings/route.ts` - Slot settings API
4. `app/api/team/purchase-football-slots/route.ts` - Purchase slots API (future)

### Pages to Update
1. `app/api/team/bulk-rounds/[id]/route.ts` - Use `football_total_slots` instead of `max_football_players`
2. `app/api/team/bulk-rounds/[id]/bids/route.ts` - Validate against `football_total_slots`
3. `app/dashboard/team/bulk-round/[id]/page.tsx` - Display available slots
4. `app/dashboard/team/budget-planner/page.tsx` - Use dynamic slots
5. `app/api/team/dashboard/route.ts` - Return `football_total_slots`

### Migration
- `migrations/add_football_slot_management.sql` - Database schema changes

## Backward Compatibility

The system maintains backward compatibility:
- If `football_total_slots` is not set, falls back to `max_football_players` (25)
- If `football_base_slots` is not set, uses `max_football_players` from season
- Existing teams automatically get base slots = 25, purchased = 0

## Validation Rules

### Adding Slots
- ✅ Can add if: `purchased_slots + slots_to_add <= max_purchasable`
- ❌ Cannot add if: Already at maximum

### Removing Slots
- ✅ Can remove if: `purchased_slots >= slots_to_remove`
- ✅ Can remove if: `total_slots - slots_to_remove >= current_players`
- ❌ Cannot remove if: Would result in fewer slots than current players

### Bulk Auction Bidding
- ✅ Can bid if: `current_players + pending_bids + new_bid <= total_slots`
- ❌ Cannot bid if: No available slots

## Future Enhancements

1. **Team Self-Service**: Allow teams to purchase slots themselves
   - Deduct eCoin from team budget
   - Create transaction record
   - Update slot count

2. **Slot History**: Track all slot changes
   - Who added/removed slots
   - When changes were made
   - Reason for changes

3. **Bulk Operations**: 
   - Add slots to multiple teams at once
   - Reset all teams to base slots
   - Import slot allocations from CSV

4. **Notifications**:
   - Notify teams when slots are added/removed
   - Alert when approaching slot limit
   - Remind teams of available slots

## Testing Checklist

- [ ] Committee can configure slot settings
- [ ] Committee can add slots to teams
- [ ] Committee can remove slots from teams
- [ ] Cannot remove slots below current player count
- [ ] Cannot add slots beyond maximum
- [ ] Bulk auction shows correct available slots
- [ ] Bulk auction prevents bidding when no slots
- [ ] Budget planner uses dynamic slots
- [ ] Team dashboard shows correct slot info
- [ ] Backward compatibility with existing data

## Notes

- **Current Implementation**: Committee admin manages all slot additions (no team self-service)
- **Pricing**: Slot price is configured but not currently charged (future feature)
- **Default Values**: Base=25, Max Purchasable=3, Price=₡10
- **Season Level**: Settings are per-season, allowing different configurations each season
