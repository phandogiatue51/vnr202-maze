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
    <Container className="home-container">
      <div
        className="p-5"
        style={{
          background: '#1e293b',
          borderRadius: '20px',
          border: '2px solid #fbbf24',
          maxWidth: '500px',
          width: '100%'
        }}
      >
        {mode === null && (
          <>
            <h2 className="mb-4 text-center">Tên của bạn là gì?</h2>
            <Form onSubmit={handleNameSubmit}>
              <Form.Group className="mb-3">
                <Form.Control
                  className="name-input-field"
                  style={{ fontSize: '1.5rem', textAlign: 'center' }}
                  type="text"
                  placeholder="Nhập tên của bạn..."
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  autoFocus
                  required
                />
              </Form.Group>
              <div className="d-grid gap-3">
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
            </Form>
          </>
        )}

        {mode === 'mode' && (
          <>
            <h2 className="mb-4 text-center">Chọn chức năng</h2>
            <p className="text-white-50 text-center mb-4">Bạn muốn làm gì?</p>
            <div className="d-flex flex-row gap-3">
              <div className="mb-4">
                <button
                  type="button"
                  className="menu-btn btn-play"
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                >
                  {isLoading ? 'Đang tạo...' : 'Tạo phòng mới'}
                </button>
              </div>
              <div className="mb-4">
                <button
                  type="button"
                  className="menu-btn btn-rule"
                  onClick={() => setMode('join')}
                  disabled={isLoading}
                >
                  Tham gia phòng có sẵn
                </button>
              </div>
              <div className="mb-4">
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
          </>
        )}

        {mode === 'join' && (
          <>
            <h2 className="mb-4 text-center">Nhập mã phòng</h2>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                handleJoinRoom();
              }}
            >
              <Form.Group className="mb-3">
                <Form.Control
                  className="name-input-field"
                  style={{
                    fontSize: '1.5rem',
                    textAlign: 'center',
                    textTransform: 'uppercase'
                  }}
                  type="text"
                  placeholder="VD: ABC123"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  autoFocus
                  maxLength={ROOM_CODE_LEN}
                  required
                />
              </Form.Group>
              <div className="d-grid gap-3">
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
            </Form>
          </>
        )}
      </div>
    </Container>
  );
};

export default NameEntryPage;
