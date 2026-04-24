import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import firebase from 'firebase/app';
import 'firebase/database';
import 'firebase/auth';
import { FIREBASE_CONFIG } from '../constants';
import { Player } from '../type';
import { createDefaultEffects, createDefaultInventory } from '../lib/item-logic';
import { generateGold } from '../lib/gold-logic';
import { generateMapItems } from '../lib/item-logic';
import { MAZE_SEED, MAZE_SIZE } from '../constants';
import './home-page.css';

type LobbyStatus = 'waiting' | 'started';

type LobbyDoc = {
  hostId: string | null;
  status: LobbyStatus;
  startedAt?: number | null;
  updatedAt?: number;
};

const toKeyedObject = <T extends { id: string }>(items: T[]): Record<string, T> => {
  return items.reduce<Record<string, T>>((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});
};

const getApp = (): firebase.app.App => {
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }
  return firebase.app();
};

const LobbyPage: React.FC = () => {
  const history = useHistory();
  const [players, setPlayers] = useState<Player[]>([]);
  const [lobbyStatus, setLobbyStatus] = useState<LobbyStatus>('waiting');
  const [isHost, setIsHost] = useState(false);
  const [myUID, setMyUID] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const roomCode = useMemo(() => localStorage.getItem('roomCode') || '', []);
  const playerName = useMemo(() => localStorage.getItem('playerName') || '', []);
  const creatorFlag = useMemo(() => localStorage.getItem('isHost') === 'true', []);
  
  const db = useMemo(() => getApp().database(), []);
  const auth = useMemo(() => getApp().auth(), []);
  
  const lobbyRef = useMemo(() => db.ref(`rooms/${roomCode}`), [db, roomCode]);
  const playersRef = useMemo(() => lobbyRef.child('players'), [lobbyRef]);

  useEffect(() => {
    const code = localStorage.getItem('roomCode') || '';
    if (!playerName || !code) {
      history.push('/');
      return () => undefined;
    }

    let isMounted = true;
    let currentUID = '';

    const ensureLobbyExists = async () => {
      const snap = await lobbyRef.once('value');
      if (!snap.exists()) {
        const initialLobby: LobbyDoc = {
          hostId: null,
          status: 'waiting',
          startedAt: null,
          updatedAt: Date.now()
        };
        await lobbyRef.update(initialLobby);
      }
    };

    const tryClaimHost = async (uid: string) => {
      await lobbyRef.child('hostId').transaction((currentHostId: string | null) => {
        if (!currentHostId) {
          return uid;
        }
        return undefined; // Abort
      });
    };

    const bootstrap = async () => {
      try {
        await auth.signInAnonymously();
        const user = auth.currentUser;
        if (!user) {
          throw new Error('Anonymous auth failed.');
        }

        currentUID = user.uid;
        if (!isMounted) return;
        setMyUID(currentUID);

        await ensureLobbyExists();
        
        const playerRef = playersRef.child(currentUID);
        const existingPlayerSnap = await playerRef.once('value');
        const existingPlayer = existingPlayerSnap.val() || {};
        await playerRef.update({
          name: playerName,
          r: existingPlayer.r ?? 0.5,
          c: existingPlayer.c ?? 0.5,
          goldCount: existingPlayer.goldCount ?? 0,
          shieldCount: existingPlayer.shieldCount ?? 0,
          inventory: {
            ...createDefaultInventory(),
            ...(existingPlayer.inventory || {})
          },
          effects: {
            ...createDefaultEffects(),
            ...(existingPlayer.effects || {})
          },
          finishTime: existingPlayer.finishTime ?? null,
          reachedGoal: Boolean(existingPlayer.reachedGoal),
          joinedAt: existingPlayer.joinedAt ?? Date.now(),
          startTime: existingPlayer.startTime ?? null,
          connected: true,
          lastSeen: null
        });

        playerRef.onDisconnect().update({
          connected: false,
          lastSeen: firebase.database.ServerValue.TIMESTAMP
        });

        await tryClaimHost(currentUID);

        const playersListener = playersRef.on('value', async (snapshot: firebase.database.DataSnapshot) => {
          const nextPlayers: Player[] = [];
          const playersData = snapshot.val() || {};
          
          Object.keys(playersData).forEach((id) => {
            const p = playersData[id];
            if (p.connected === false) return;
            nextPlayers.push({
              id: id,
              name: p.name,
              location: { r: p.r || 0, c: p.c || 0 },
              goldCount: p.goldCount || 0,
              shieldCount: p.shieldCount || 0,
              inventory: p.inventory || createDefaultInventory(),
              effects: p.effects || createDefaultEffects(),
              finishTime: p.finishTime,
              reachedGoal: Boolean(p.reachedGoal),
              joinedAt: p.joinedAt,
              startTime: p.startTime,
              connected: p.connected !== false,
              lastSeen: p.lastSeen
            });
          });
          
          setPlayers(nextPlayers);

          const lobbySnap = await lobbyRef.once('value');
          const lobbyData = (lobbySnap.val() || {}) as LobbyDoc;
          
          if (lobbyData.hostId && nextPlayers.some((p) => p.id === lobbyData.hostId)) {
            return;
          }

          if (nextPlayers.length === 0) {
            await lobbyRef.update({
              hostId: null,
              status: 'waiting',
              startedAt: null,
              updatedAt: Date.now()
            });
            return;
          }

          const nextHost = [...nextPlayers].sort(
            (a, b) =>
              (a.joinedAt || Number.MAX_SAFE_INTEGER) - (b.joinedAt || Number.MAX_SAFE_INTEGER)
          )[0];

          if (nextHost?.id) {
            await lobbyRef.update({
              hostId: nextHost.id,
              status: 'waiting',
              updatedAt: Date.now()
            });
          }
        });

        const lobbyListener = lobbyRef.on('value', (snapshot: firebase.database.DataSnapshot) => {
          const data = (snapshot.val() || {}) as LobbyDoc;
          const status = data.status || 'waiting';
          setLobbyStatus(status);
          setIsHost(Boolean(currentUID && data.hostId === currentUID));
          setLoading(false);
          if (status === 'started') {
            history.push('/game');
          }
        });

        return () => {
          playersRef.off('value', playersListener);
          lobbyRef.off('value', lobbyListener);
        };
      } catch (error) {
        console.error('Lobby init failed:', error);
        setLoading(false);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
      playersRef.off();
      lobbyRef.off();
    };
  }, [auth, db, history, lobbyRef, playerName, playersRef]);

  const canManageLobby = isHost || creatorFlag;

  const handleStartGame = async () => {
    if (!canManageLobby || !myUID) return;
    const now = Date.now();

    const snapshot = await playersRef.once('value');
    const playersData = snapshot.val() || {};
    const activePlayers = Object.keys(playersData).filter((id) => playersData[id]?.connected !== false);
    const golds = toKeyedObject(generateGold(MAZE_SIZE, MAZE_SEED));
    const items = toKeyedObject(generateMapItems(MAZE_SIZE, MAZE_SEED));
    
    const updates: any = {};
    activePlayers.forEach((id) => {
      const playerData = playersData[id] || {};
      updates[`players/${id}/startTime`] = now;
      updates[`players/${id}/finishTime`] = null;
      updates[`players/${id}/reachedGoal`] = false;
      updates[`players/${id}/goldCount`] = 0;
      updates[`players/${id}/shieldCount`] = 0;
      updates[`players/${id}/inventory`] = createDefaultInventory();
      updates[`players/${id}/effects`] = createDefaultEffects();
      updates[`players/${id}/r`] = 0.5;
      updates[`players/${id}/c`] = 0.5;
      updates[`players/${id}/connected`] = true;
      updates[`players/${id}/lastSeen`] = null;
      updates[`players/${id}/name`] = playerData.name || playerName;
    });

    updates['golds'] = golds;
    updates['items'] = items;
    updates['hostId'] = myUID;
    updates['status'] = 'started';
    updates['startedAt'] = now;
    updates['updatedAt'] = now;

    await lobbyRef.update(updates);
  };

  const handleResetLobby = async () => {
    if (!canManageLobby || !myUID) return;
    await lobbyRef.update({
      hostId: myUID,
      status: 'waiting',
      startedAt: null,
      updatedAt: Date.now()
    });
  };

  const handleLeaveLobby = async () => {
    if (myUID) {
      await playersRef.child(myUID).remove();
      const lobbySnapshot = await lobbyRef.once('value');
      const data = (lobbySnapshot.val() || {}) as LobbyDoc;
      if (data.hostId === myUID) {
        await lobbyRef.update({
          hostId: null,
          status: 'waiting',
          startedAt: null,
          updatedAt: Date.now()
        });
      }
    }
    localStorage.removeItem('playerName');
    localStorage.removeItem('roomCode');
    localStorage.removeItem('isHost');
    history.push('/');
  };

  const handleCopyRoomCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopyState('copied');
    } catch (error) {
      console.error('Copy room code failed:', error);
      setCopyState('failed');
    }

    window.setTimeout(() => {
      setCopyState('idle');
    }, 2000);
  };

  const getStatusMsg = (): string => {
    if (loading) {
      return 'Đang kết nối vào sảnh chờ...';
    }
    if (canManageLobby) {
      return 'Bạn là chủ phòng. Khi mọi người đã sẵn sàng, hãy bắt đầu trận đấu.';
    }
    return 'Bạn đang chờ chủ phòng bắt đầu trận đấu.';
  };

  const getCopyButtonText = (): string => {
    if (copyState === 'copied') {
      return 'Đã sao chép mã phòng';
    }
    if (copyState === 'failed') {
      return 'Không thể sao chép';
    }
    return 'Sao chép mã phòng';
  };

  const getLobbyStatusLabel = (): string => {
    return lobbyStatus === 'started' ? 'Đang thi đấu' : 'Đang chờ';
  };

  return (
    <div className="home-container lobby-shell">
      <div className="home-bg-overlay" />
      <div className="lobby-card">
        <div className="lobby-hero">
          <div className="lobby-hero-copy">
            <span className="lobby-eyebrow">Phòng thi đấu</span>
            <h2 className="lobby-title">Sảnh chờ</h2>
            <p className="lobby-status-message">{getStatusMsg()}</p>
          </div>

          <div className="lobby-room-pill">
            <span className="lobby-room-pill-label">Mã phòng</span>
            <strong className="lobby-room-pill-value">{roomCode || '------'}</strong>
          </div>
        </div>

        <div className="lobby-meta-grid">
          <div className="lobby-meta-card">
            <span className="lobby-meta-label">Trạng thái</span>
            <strong className="lobby-meta-value">{getLobbyStatusLabel()}</strong>
          </div>

          <div className="lobby-meta-card">
            <span className="lobby-meta-label">Người chơi</span>
            <strong className="lobby-meta-value">{players.length}</strong>
          </div>
          
          <div className="lobby-meta-card">
            <span className="lobby-meta-label">Vai trò</span>
            <strong className="lobby-meta-value">{canManageLobby ? 'Chủ phòng' : 'Thành viên'}</strong>
          </div>
        </div>

        <div className="lobby-section">
          <div className="lobby-section-header">
            <div>
              <h3 className="lobby-section-title">Người đang trong phòng</h3>
              <p className="lobby-section-subtitle">
                Kiểm tra nhanh ai đã sẵn sàng trước khi bắt đầu.
              </p>
            </div>
            <div className="lobby-user-badge">
              <span className="lobby-user-badge-label">Bạn</span>
              <span className="lobby-user-badge-value">{playerName}</span>
            </div>
          </div>

          <div className="lobby-player-grid">
            {players.map((p: Player, index: number) => {
              const isMe = p.id === myUID;
              const isPlayerHost = p.id === players[0]?.id;
              return (
                <div
                  key={p.id}
                  className={`lobby-player-chip lobby-player-card-${(index % 4) + 1}${isMe ? ' is-me' : ''}`}
                >
                  <div className="lobby-player-orb-wrap">
                    <div className="lobby-player-avatar">
                      <span className="lobby-player-avatar-letter">
                        {(p.name || '?').slice(0, 1).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="lobby-player-text">
                    <span className="lobby-player-name">{p.name}</span>
                  </div>

                  <div className="lobby-player-chip-bottom">
                    <span className="lobby-player-index">#{index + 1}</span>
                    <div className="lobby-player-badges">
                      {isMe && <span className="lobby-player-badge">Bạn</span>}
                      <span className="lobby-player-status-dot" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lobby-section lobby-actions-panel">
          <div className="lobby-section-header">
            <div>
              <h3 className="lobby-section-title">Điều khiển phòng</h3>
              <p className="lobby-section-subtitle">
                Sao chép mã phòng hoặc bắt đầu khi mọi người đã vào đủ.
              </p>
            </div>
          </div>

          <div className="lobby-action-grid">
            <button type="button" onClick={handleCopyRoomCode} className="menu-btn btn-soft">
              {getCopyButtonText()}
            </button>

            {canManageLobby && (
              <button
                type="button"
                onClick={handleStartGame}
                disabled={players.length < 1 || loading}
                className="menu-btn btn-play"
              >
                {loading ? 'Đang tải...' : 'Bắt đầu trò chơi'}
              </button>
            )}

            {canManageLobby && (
              <button type="button" onClick={handleResetLobby} className="menu-btn btn-danger-soft">
                Đặt lại phòng
              </button>
            )}

            <button type="button" onClick={handleLeaveLobby} className="menu-btn btn-rule">
              Rời sảnh và đổi tên
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;
