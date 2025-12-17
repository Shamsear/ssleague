'use client';

import { useState } from 'react';
import { Crown, Star, Shield } from 'lucide-react';

interface Player {
  player_name: string;
  total_points: number;
  is_captain?: boolean;
  is_vice_captain?: boolean;
}

interface ShareableTeamCardProps {
  teamName: string;
  ownerName: string;
  totalPoints: number;
  supportedTeamName?: string;
  passivePoints?: number;
  players: Player[];
  leagueName?: string;
}

export default function ShareableTeamCard({
  teamName,
  ownerName,
  totalPoints,
  supportedTeamName,
  passivePoints,
  players,
  leagueName
}: ShareableTeamCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCopied, setShowCopied] = useState(false);

  const generateTextShare = async () => {
    setIsGenerating(true);
    try {
      // Generate text-based team card
      let text = `⚡ ${leagueName || 'Fantasy League'}\n`;
      text += `🏆 ${teamName}\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      text += `📊 TOTAL POINTS: ${totalPoints}\n`;
      text += `━━━━━━━━━━━━━━━━━━━━\n`;

      if (supportedTeamName) {
        text += `🛡️ Supported Team: ${supportedTeamName}\n`;
        text += `   Passive Points: +${passivePoints || 0}\n`;
      }

      text += `⚽ SQUAD (${players.length} Players):\n`;
      
      players.slice(0, 10).forEach((player, index) => {
        const rank = index + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
        const badges = [];
        if (player.is_captain) badges.push('(C)');
        if (player.is_vice_captain) badges.push('(VC)');
        const badgeText = badges.length > 0 ? ` ${badges.join(' ')}` : '';
        
        text += `${medal} ${player.player_name}${badgeText} - ${player.total_points} pts\n`;
      });

      if (players.length > 10) {
        text += `... and ${players.length - 10} more players\n`;
      }

      text += `━━━━━━━━━━━━━━━━━━━━\n`;
      text += `🎮 Generated from Fantasy League`;

      // Copy to clipboard
      await navigator.clipboard.writeText(text);
      
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (error) {
      console.error('Error generating text:', error);
      alert('Failed to copy to clipboard');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={generateTextShare}
        disabled={isGenerating}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            Copying...
          </>
        ) : showCopied ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy Team Card
          </>
        )}
      </button>
    </div>
  );
}
