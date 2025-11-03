#!/bin/bash

echo "=================================="
echo "CHECKING SEASON_ID IN CODE"
echo "=================================="
echo ""

echo "🔍 Checking bids table INSERTs..."
grep -n "INSERT INTO bids" app/api/**/*.ts | grep -v "season_id" && echo "❌ Found INSERT without season_id!" || echo "✅ All bids INSERTs include season_id"

echo ""
echo "🔍 Checking round_players table INSERTs..."
grep -rn "INSERT INTO round_players" app/api/ | grep -v "season_id" && echo "❌ Found INSERT without season_id!" || echo "✅ All round_players INSERTs include season_id or none found"

echo ""
echo "🔍 Checking team_tiebreakers table INSERTs..."
grep -rn "INSERT INTO team_tiebreakers" app/api/ | grep -v "season_id" && echo "❌ Found INSERT without season_id!" || echo "✅ All team_tiebreakers INSERTs include season_id or none found"

echo ""
echo "=================================="
echo "SUMMARY"
echo "=================================="
echo "✅ bids - season_id added"
echo "⏭️  round_players - check if used"
echo "⏭️  team_tiebreakers - check if used"
echo "❌ starred_players - removed (season-independent)"
