import React, { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/auth';
import Nav from '../components/nav';
import Leaderboard from '../components/leaderboard';
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
  const db = useMemo(() => getApp().firestore(), []);
  const auth = useMemo(() => getApp().auth(), []);
  const playersCol = useMemo(() => db.collection('rooms').doc(roomCode).collection('players'), [
    db,
    roomCode
  ]);
  const lobbyDoc = useMemo(() => db.collection('rooms').doc(roomCode), [db, roomCode]);

  useEffect(() => {
    const playerName = localStorage.getItem('playerName') || '';
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
  }, [auth, db, history, lobbyDoc, playersCol, roomCode]);

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
      return 'Bạn là chủ phòng. Hãy bắt đầu khi mọi người đã sẵn sàng.';
    }
    return 'Đang chờ chủ phòng bắt đầu cuộc đua...';
  };

  return (
    <>
      <Nav />
      <div
        className="home-container"
        style={{
          minHeight: 'calc(100vh - 100px)',
          justifyContent: 'flex-start',
          paddingTop: '4rem'
        }}
      >
        <div
          className="p-5"
          style={{
            background: '#1e293b',
            borderRadius: '20px',
            border: '2px solid #fbbf24',
            maxWidth: '600px',
            width: '100%',
            textAlign: 'center'
          }}
        >
          <h2 className="text-warning mb-3 font-bold text-4xl">Sảnh chờ</h2>
          <p className="text-white-50 mb-4">{getStatusMsg()}</p>

          <div className="lobby-meta-grid">
            <div className="lobby-meta-card">
              <span className="lobby-meta-label">Mã phòng</span>
              <strong className="lobby-meta-value">{roomCode || '------'}</strong>
            </div>
            <div className="lobby-meta-card">
              <span className="lobby-meta-label">Trạng thái</span>
              <strong className="lobby-meta-value">
                {lobbyStatus === 'started' ? 'Đang thi đấu' : 'Đang chờ'}
              </strong>
            </div>
            <div className="lobby-meta-card">
              <span className="lobby-meta-label">Số người chơi</span>
              <strong className="lobby-meta-value">{players.length}</strong>
            </div>
          </div>

          <div
            style={{
              maxHeight: '400px',
              overflowY: 'auto',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'center'
            }}
          >
            <Leaderboard players={players} title="Danh sách người chơi" myUID={myUID} />
          </div>

          <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <span className="text-white-50">
                Tên của bạn:{' '}
                <span className="text-warning fw-bold">{localStorage.getItem('playerName')}</span>
              </span>
              {isHost && <span className="badge bg-warning text-dark"> [CHỦ PHÒNG]</span>}
            </div>

            <div className="lobby-action-grid">
              <button
                type="button"
                onClick={handleCopyRoomCode}
                className="btn btn-outline-light"
                style={{ borderRadius: '12px', border: '2px solid #fbbf24' }}
              >
                {copyState === 'copied'
                  ? 'Đã sao chép mã phòng'
                  : copyState === 'failed'
                    ? 'Không thể sao chép'
                    : 'Sao chép mã phòng'}
              </button>

              {isHost && (
                <>
                  <button
                    type="button"
                    onClick={handleStartGame}
                    className="btn btn-warning btn-lg fw-bold"
                    style={{ borderRadius: '12px', border: '2px solid #fbbf24' }}
                    disabled={players.length < 1 || loading}
                  >
                    Bắt đầu trò chơi
                  </button>
                  <button
                    type="button"
                    onClick={handleResetLobby}
                    className="btn btn-outline-danger"
                    style={{ borderRadius: '12px', border: '2px solid #f87171' }}
                  >
                    Đặt lại về trạng thái chờ
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={handleLeaveLobby}
                className="btn btn-outline-secondary"
                style={{ borderRadius: '12px', border: '2px solid #6b7280' }}
              >
                Rời sảnh và đổi tên
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LobbyPage;
