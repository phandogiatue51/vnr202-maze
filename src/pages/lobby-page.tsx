import React, { useState, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import firebase from 'firebase/app';
import 'firebase/firestore';
import Nav from '../components/nav';
import Leaderboard from '../components/leaderboard';
import { Player } from '../type';
import MultiplayerGame from '../lib/multiplayer-game';

const LobbyPage: React.FC = () => {
  const history = useHistory();
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [myUID, setMyUID] = useState<string | undefined>(undefined);
  const gameRef = useRef<MultiplayerGame | null>(null);

  useEffect(() => {
    const playerName = localStorage.getItem('playerName') || '';
    if (!playerName) {
      history.push('/');
      return;
    }

    // Bypass lobby and go to game
    history.push('/game');
  }, [history]);

  const handleStartGame = () => {
    if (gameRef.current && isHost) {
      gameRef.current.startGame();
    }
  };

  const handleResetScores = () => {
    if (gameRef.current && isHost) {
      gameRef.current.purgePlayers();
      // After purging, we need to re-enter to stay in lobby
      const playerName = localStorage.getItem('playerName');
      if (playerName && gameRef.current) gameRef.current.enterGame(playerName);
    }
  };

  const handleLeaveLobby = () => {
    if (gameRef.current) {
      gameRef.current.removePlayerExplicitly();
    }
    localStorage.removeItem('playerName');
    history.push('/');
  };

  return (
    <>
      <Nav />
      <div className="home-container" style={{ minHeight: 'calc(100vh - 100px)', justifyContent: 'flex-start', paddingTop: '4rem' }}>
        <div className="p-5" style={{ background: '#1e293b', borderRadius: '20px', border: '2px solid #fbbf24', maxWidth: '600px', width: '100%', textAlign: 'center' }}>
          <h2 className="text-warning mb-4">🏠 Sảnh Chờ (Lobby)</h2>
          <p className="text-white-50 mb-4">
            {isHost ? 'Bạn là chủ phòng. Hãy bắt đầu khi mọi người đã sẵn sàng!' : 'Đang chờ Chủ phòng bắt đầu cuộc đua...'}
          </p>

          <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px' }}>
            <Leaderboard players={players} title="Danh sách người chơi" myUID={myUID} />
          </div>

          <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="text-white-50">Tên của bạn: <span className="text-warning fw-bold">{localStorage.getItem('playerName')}</span></span>
              {isHost && (
                <span className="badge bg-warning text-dark">CHỦ PHÒNG</span>
              )}
            </div>

            <div className="d-grid gap-2">
              {isHost && (
                <>
                  <button
                    onClick={handleStartGame}
                    className="btn btn-warning btn-lg fw-bold"
                    style={{ borderRadius: '12px' }}
                  >
                    🚀 BẮT ĐẦU TRÒ CHƠI
                  </button>
                  <button
                    onClick={handleResetScores}
                    className="btn btn-outline-danger btn-sm"
                    style={{ borderRadius: '8px' }}
                  >
                    Dọn dẹp danh sách
                  </button>
                </>
              )}
              <button
                onClick={handleLeaveLobby}
                className="btn btn-outline-secondary btn-sm mt-2"
                style={{ borderRadius: '8px' }}
              >
                🚪 Rời Sảnh & Đổi tên
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LobbyPage;