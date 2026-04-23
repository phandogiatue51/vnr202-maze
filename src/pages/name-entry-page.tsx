import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Container, Form } from 'react-bootstrap';
import './home-page.css';

const ID_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const ROOM_CODE_LEN = 6;

const generateRoomCode = (): string => {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    code += ID_CHARSET.charAt(Math.floor(Math.random() * ID_CHARSET.length));
  }
  return code;
};

const NameEntryPage: React.FC = () => {
  const history = useHistory();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'name' | 'mode' | 'join' | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    setMode('mode');
  };

  const handleCreateRoom = async () => {
    if (!playerName.trim()) return;
    setIsLoading(true);
    const newCode = generateRoomCode();
    localStorage.setItem('playerName', playerName);
    localStorage.setItem('roomCode', newCode);
    localStorage.setItem('isHost', 'true');
    history.push('/lobby');
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim() || !roomCode.trim()) return;
    setIsLoading(true);
    localStorage.setItem('playerName', playerName);
    localStorage.setItem('roomCode', roomCode.toUpperCase());
    localStorage.setItem('isHost', 'false');
    history.push('/lobby');
  };

  return (
    <div className="home-container">
      <div className="home-bg-overlay" />
      <div className="name-entry-card">
        {mode === null && (
          <div className="fade-in">
            <h2 className="mb-4 text-center" style={{ fontWeight: 800, color: '#0f172a' }}>Tên của bạn là gì?</h2>
            <form onSubmit={handleNameSubmit}>
              <div className="mb-4">
                <input
                  className="name-input-field"
                  style={{ 
                    fontSize: '1.5rem', 
                    textAlign: 'center', 
                    width: '100%',
                    padding: '1rem',
                    borderRadius: '16px',
                    border: '2px solid #f1f5f9',
                    background: '#f8fafc',
                    color: '#0f172a'
                  }}
                  type="text"
                  placeholder="Nhập tên của bạn..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="d-grid gap-3" style={{ display: 'grid', gap: '1rem' }}>
                <button type="submit" className="menu-btn btn-play" disabled={!playerName.trim()}>
                  Tiếp tục
                </button>
                <button
                  type="button"
                  className="menu-btn btn-rule"
                  onClick={() => history.push('/')}
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {mode === 'mode' && (
          <div className="fade-in">
            <h2 className="mb-4 text-center" style={{ fontWeight: 800, color: '#0f172a' }}>Chọn chức năng</h2>
            <p className="text-center mb-4" style={{ color: '#64748b' }}>Bạn muốn làm gì?</p>
            <div className="d-grid gap-3" style={{ display: 'grid', gap: '1rem' }}>
              <button
                type="button"
                className="menu-btn btn-play"
                onClick={handleCreateRoom}
                disabled={isLoading}
              >
                {isLoading ? 'Đang tạo...' : 'Tạo phòng mới'}
              </button>
              <button
                type="button"
                className="menu-btn btn-rule"
                onClick={() => setMode('join')}
                disabled={isLoading}
              >
                Tham gia phòng có sẵn
              </button>
              <button
                type="button"
                className="menu-btn btn-rule"
                onClick={() => setMode(null)}
                disabled={isLoading}
              >
                Quay lại
              </button>
            </div>
          </div>
        )}

        {mode === 'join' && (
          <div className="fade-in">
            <h2 className="mb-4 text-center" style={{ fontWeight: 800, color: '#0f172a' }}>Nhập mã phòng</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoinRoom();
              }}
            >
              <div className="mb-4">
                <input
                  className="name-input-field"
                  style={{
                    fontSize: '1.5rem',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    width: '100%',
                    padding: '1rem',
                    borderRadius: '16px',
                    border: '2px solid #f1f5f9',
                    background: '#f8fafc',
                    color: '#0f172a'
                  }}
                  type="text"
                  placeholder="VD: ABC123"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  autoFocus
                  maxLength={ROOM_CODE_LEN}
                  required
                />
              </div>
              <div className="d-grid gap-3" style={{ display: 'grid', gap: '1rem' }}>
                <button
                  type="submit"
                  className="menu-btn btn-play"
                  disabled={!roomCode.trim() || isLoading}
                >
                  {isLoading ? 'Đang vào...' : 'Vào phòng'}
                </button>
                <button
                  type="button"
                  className="menu-btn btn-rule"
                  onClick={() => setMode('mode')}
                  disabled={isLoading}
                >
                  Quay lại
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default NameEntryPage;
