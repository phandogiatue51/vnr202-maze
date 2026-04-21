/* eslint-disable react/prop-types */
import React, { useMemo } from 'react';
import { Player } from '../type';
import './leaderboard.css';

interface LeaderboardProps {
  players: Player[];
  title?: string;
  myUID?: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ players, title = 'Live Rankings', myUID }) => {
  // Sort players: 1. Gold Count (Desc), 2. Finish Time (Asc, if exists)
  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const goldA = a.goldCount || 0;
      const goldB = b.goldCount || 0;
      if (goldB !== goldA) return goldB - goldA;

      // Tie breaker: finish time (smaller is better)
      if (a.finishTime && b.finishTime) return a.finishTime - b.finishTime;
      if (a.finishTime) return -1;
      if (b.finishTime) return 1;

      return 0;
    });
  }, [players]);

  return (
    <div className="leaderboard-container">
      <h3 className="leaderboard-title">{title}</h3>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Gold</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedPlayers.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-4 text-white-50">
                <i>Waiting for players to join...</i>
              </td>
            </tr>
          ) : sortedPlayers.map((player, index) => {
            const isMe = player.id === myUID;
            return (
              <tr key={player.id} className={isMe ? 'row-me' : ''}>
                <td>
                  <span className={`rank-badge rank-${index + 1}`}>{index + 1}</span>
                </td>

                <td className="player-id-cell">
                  {isMe ? 'You' : (player.name || `Player ${player.id.substring(0, 4)}`)}
                </td>
                <td className="gold-cell">
                  <span className="gold-text">{player.goldCount || 0}</span>
                </td>
                <td className="status-cell">
                  {player.finishTime ? (
                    <span className="status-finished">Finished!</span>
                  ) : (
                    <span className="status-racing">Racing...</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;
