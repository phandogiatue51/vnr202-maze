import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import { FIREBASE_CONFIG } from '../constants';
import { Player } from '../type';
import './home-page.css';

type LobbyStatus = 'waiting' | 'started';

type LobbyDoc = {
  hostId: string | null;
  status: LobbyStatus;
  startedAt?: number | null;
  updatedAt?: number;
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
  const db = useMemo(() => getApp().firestore(), []);
  const auth = useMemo(() => getApp().auth(), []);
  const playersCol = useMemo(() => db.collection('rooms').doc(roomCode).collection('players'), [
    db,
    roomCode
  ]);
  const lobbyDoc = useMemo(() => db.collection('rooms').doc(roomCode), [db, roomCode]);

  useEffect(() => {
    const code = localStorage.getItem('roomCode') || '';
    if (!playerName || !code) {
      history.push('/');
      return () => undefined;
    }

    let isMounted = true;
    let currentUID = '';
    let unsubscribePlayers: (() => void) | undefined;
    let unsubscribeLobby: (() => void) | undefined;

    const ensureLobbyExists = async () => {
      const snap = await lobbyDoc.get();
      if (!snap.exists) {
        const initialLobby: LobbyDoc = {
          hostId: null,
          status: 'waiting',
          startedAt: null,
          updatedAt: Date.now()
        };
        await lobbyDoc.set(initialLobby, { merge: true });
      }
    };

    const tryClaimHost = async (uid: string) => {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(lobbyDoc);
        const data = (snap.data() || {}) as LobbyDoc;
        if (!data.hostId) {
          tx.set(
            lobbyDoc,
            {
              hostId: uid,
              status: data.status || 'waiting',
              updatedAt: Date.now()
            },
            { merge: true }
          );
        }
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
        await playersCol.doc(currentUID).set(
          {
            name: playerName,
            r: 0.5,
            c: 0.5,
            goldCount: 0,
            finishTime: null,
            joinedAt: Date.now(),
            startTime: null
          },
          { merge: true }
        );
        await tryClaimHost(currentUID);

        unsubscribePlayers = playersCol.onSnapshot(async (snapshot) => {
          const nextPlayers: Player[] = [];
          snapshot.forEach((doc) => {
            const p = doc.data();
            nextPlayers.push({
              id: doc.id,
              name: p.name,
              location: { r: p.r || 0, c: p.c || 0 },
              goldCount: p.goldCount || 0,
              finishTime: p.finishTime,
              joinedAt: p.joinedAt,
              startTime: p.startTime
            });
          });
          setPlayers(nextPlayers);

          const lobbySnapshot = await lobbyDoc.get();
          const lobbyData = (lobbySnapshot.data() || {}) as LobbyDoc;
          if (lobbyData.hostId && nextPlayers.some((p) => p.id === lobbyData.hostId)) {
            return;
          }

          if (nextPlayers.length === 0) {
            await lobbyDoc.set(
              { hostId: null, status: 'waiting', startedAt: null, updatedAt: Date.now() },
              { merge: true }
            );
            return;
          }

          const nextHost = [...nextPlayers].sort(
            (a, b) =>
              (a.joinedAt || Number.MAX_SAFE_INTEGER) - (b.joinedAt || Number.MAX_SAFE_INTEGER)
          )[0];

          if (nextHost?.id) {
            await lobbyDoc.set(
              {
                hostId: nextHost.id,
                status: 'waiting',
                updatedAt: Date.now()
              },
              { merge: true }
            );
          }
        });

        unsubscribeLobby = lobbyDoc.onSnapshot((snapshot) => {
          const data = (snapshot.data() || {}) as LobbyDoc;
          const status = data.status || 'waiting';
          setLobbyStatus(status);
          setIsHost(Boolean(currentUID && data.hostId === currentUID));
          setLoading(false);
          if (status === 'started') {
            history.push('/game');
          }
        });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Lobby init failed:', error);
        setLoading(false);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
      if (unsubscribePlayers) unsubscribePlayers();
      if (unsubscribeLobby) unsubscribeLobby();
    };
  }, [auth, db, history, lobbyDoc, playerName, playersCol]);

  const handleStartGame = async () => {
    if (!isHost || !myUID) return;
    const now = Date.now();

    const snapshot = await playersCol.get();
    const batch = db.batch();
    snapshot.forEach((doc) => {
      batch.set(
        playersCol.doc(doc.id),
        {
          startTime: now,
          finishTime: null,
          goldCount: 0,
          r: 0.5,
          c: 0.5
        },
        { merge: true }
      );
    });

    batch.set(
      lobbyDoc,
      {
        hostId: myUID,
        status: 'started',
        startedAt: now,
        updatedAt: now
      },
      { merge: true }
    );

    await batch.commit();
  };

  const handleResetLobby = async () => {
    if (!isHost || !myUID) return;
    await lobbyDoc.set(
      {
        hostId: myUID,
        status: 'waiting',
        startedAt: null,
        updatedAt: Date.now()
      },
      { merge: true }
    );
  };

  const handleLeaveLobby = async () => {
    if (myUID) {
      await playersCol.doc(myUID).delete();
      const lobbySnapshot = await lobbyDoc.get();
      const data = (lobbySnapshot.data() || {}) as LobbyDoc;
      if (data.hostId === myUID) {
        await lobbyDoc.set(
          {
            hostId: null,
            status: 'waiting',
            startedAt: null,
            updatedAt: Date.now()
          },
          { merge: true }
        );
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
      // eslint-disable-next-line no-console
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
    if (isHost) {
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
            <strong className="lobby-meta-value">{isHost ? 'Chủ phòng' : 'Thành viên'}</strong>
          </div>
        </div>

        <div className="lobby-section">
          <div className="lobby-section-header">
            <div>
              <h3 className="lobby-section-title">Người đang trong phòng</h3>
              <p className="lobby-section-subtitle">Kiểm tra nhanh ai đã sẵn sàng trước khi bắt đầu.</p>
            </div>
            <div className="lobby-user-badge">
              <span className="lobby-user-badge-label">Bạn</span>
              <span className="lobby-user-badge-value">{playerName}</span>
            </div>
          </div>

          <div className="lobby-player-grid">
            {players.map((p, index) => {
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
                    <span className="lobby-player-role">
                      {isPlayerHost ? 'Chủ phòng' : 'Sẵn sàng tham gia'}
                    </span>
                  </div>

                  <div className="lobby-player-chip-bottom">
                    <span className="lobby-player-index">#{index + 1}</span>
                    <div className="lobby-player-badges">
                      {isMe && <span className="lobby-player-badge">Bạn</span>}
                      {isPlayerHost && <span className="lobby-host-tag">Host</span>}
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
              <p className="lobby-section-subtitle">Sao chép mã phòng hoặc bắt đầu khi mọi người đã vào đủ.</p>
            </div>
          </div>

          <div className="lobby-action-grid">
            <button type="button" onClick={handleCopyRoomCode} className="menu-btn btn-soft">
              {getCopyButtonText()}
            </button>

            {isHost && (
              <button
                type="button"
                onClick={handleStartGame}
                disabled={players.length < 1 || loading}
                className="menu-btn btn-play"
              >
                {loading ? 'Đang tải...' : 'Bắt đầu trò chơi'}
              </button>
            )}

            {isHost && (
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
