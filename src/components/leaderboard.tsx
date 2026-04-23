/* eslint-disable react/prop-types */
import React, { useMemo } from 'react';
import { Player } from '../type';
import './leaderboard.css';

interface LeaderboardProps {
  players: Player[];
  title?: string;
  myUID?: string;
  variant?: 'live' | 'result';
  onChoosePlayer?: (playerId: string) => void;
  canChoose?: boolean;
}

type RankedPlayer = {
  player: Player;
  rank: number;
};

const getDisplayName = (player: Player): string => {
  return player.name || `Người chơi ${player.id.substring(0, 4)}`;
};

const comparePlayers = (a: Player, b: Player): number => {
  const reachedA = Boolean(a.reachedGoal);
  const reachedB = Boolean(b.reachedGoal);

  // 1. Finished players first
  if (reachedA !== reachedB) return reachedA ? -1 : 1;

  // 2. Both same status (either both finished or both unfinished), sort by goldCount (score)
  const goldA = a.goldCount || 0;
  const goldB = b.goldCount || 0;
  if (goldB !== goldA) return goldB - goldA;

  // 3. If both finished and same goldCount, sort by finishTime (less is better)
  if (reachedA && reachedB) {
    const timeA = a.finishTime || Number.MAX_SAFE_INTEGER;
    const timeB = b.finishTime || Number.MAX_SAFE_INTEGER;
    if (timeA !== timeB) return timeA - timeB;
  }

  // 4. Fallback to name
  return getDisplayName(a).localeCompare(getDisplayName(b), 'vi', { sensitivity: 'base' });
};

const buildRankedPlayers = (players: Player[], variant: 'live' | 'result'): RankedPlayer[] => {
  const sortedPlayers = [...players].sort(comparePlayers);

  if (variant !== 'result' || sortedPlayers.length === 0) {
    return sortedPlayers.map((player, index) => ({ player, rank: index + 1 }));
  }

  const topGold = sortedPlayers[0].goldCount || 0;
  const topGroup = sortedPlayers.filter((player) => (player.goldCount || 0) === topGold);
  const topGroupAllNotReached = topGroup.every((player) => !player.reachedGoal);

  if (!topGroupAllNotReached) {
    return sortedPlayers.map((player, index) => ({ player, rank: index + 1 }));
  }

  return sortedPlayers.map((player, index) => ({
    player,
    rank: index < topGroup.length ? 1 : index + 1
  }));
};

const Leaderboard: React.FC<LeaderboardProps> = ({
  players,
  title = 'Bảng xếp hạng trực tiếp',
  myUID,
  variant = 'live',
  onChoosePlayer,
  canChoose = false
}) => {
  const rankedPlayers = useMemo(() => buildRankedPlayers(players, variant), [players, variant]);

  const getStatusLabel = (player: Player): string => {
    if (player.reachedGoal) {
      return 'Về đích';
    }
    if (variant === 'result') {
      return 'Chưa về đích';
    }
    return 'Đang thi đấu...';
  };

  return (
    <div className="leaderboard-container">
      <h3 className="leaderboard-title">{title}</h3>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>Hạng</th>
            <th>Người chơi</th>
            <th>Tài liệu</th>
            <th>Trạng thái</th>
            {variant === 'live' && <th>Hành động</th>}
          </tr>
        </thead>
        <tbody>
          {rankedPlayers.length === 0 ? (
            <tr>
              <td colSpan={variant === 'live' ? 5 : 4} className="text-center py-4 text-white-50">
                <i>Đợi người chơi tham gia...</i>
              </td>
            </tr>
          ) : (
            rankedPlayers.map(({ player, rank }, index) => {
              const isMe = player.id === myUID;
              const canBeTargeted = !isMe && !player.reachedGoal;

              return (
                <tr key={player.id} className={isMe ? 'row-me' : ''}>
                  <td>
                    <span className={`rank-badge rank-${Math.min(rank, 3)}`}>{rank}</span>
                  </td>

                  <td className="player-id-cell">{getDisplayName(player)}</td>
                  <td className="gold-cell">
                    <span className="gold-text">{player.goldCount || 0}</span>
                  </td>
                  <td className="status-cell">
                    {player.reachedGoal ? (
                      <span className="status-finished">{getStatusLabel(player)}</span>
                    ) : (
                      <span className={variant === 'result' ? 'status-pending' : 'status-racing'}>
                        {getStatusLabel(player)}
                      </span>
                    )}
                  </td>
                  {variant === 'live' && (
                    <td className="action-cell">
                      {canBeTargeted && (
                        <button
                          className={`btn-choose ${canChoose ? 'active' : 'disabled'}`}
                          onClick={() => canChoose && onChoosePlayer?.(player.id)}
                          disabled={!canChoose}
                        >
                          Chọn
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;
