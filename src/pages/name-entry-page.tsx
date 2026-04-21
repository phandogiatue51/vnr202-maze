import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { Container, Form } from 'react-bootstrap';
import './home-page.css';

const NameEntryPage: React.FC = () => {
  const history = useHistory();
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || isCreating) return;

    setIsCreating(true);

    // Save name to localStorage
    localStorage.setItem('playerName', playerName);

    // Navigate immediately - the game will handle the session
    history.push('/game');
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
        <h2 className="mb-4 text-center">Tên của bạn là gì?</h2>
        <Form onSubmit={handleStart}>
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
              disabled={isCreating}
            />
          </Form.Group>
          <div className="d-grid gap-3">
            <button type="submit" className="menu-btn btn-play" disabled={isCreating}>
              {isCreating ? 'Đang vào... 🚀' : 'Vào Cuộc Đua 🚀'}
            </button>
            <button type="button" className="menu-btn btn-rule" onClick={() => history.push('/')}>
              Hủy
            </button>
          </div>
        </Form>
      </div>
    </Container>
  );
};

export default NameEntryPage;