import React from 'react';
import { useHistory } from 'react-router-dom';
import './home-page.css';

const HomePage: React.FC = () => {
  const history = useHistory();

  return (
    <div className="home-container">
      <div className="title-section">
        <h1 className="game-title">TITLE</h1>
        <p className="game-subtitle">Hành Trình Di Sản</p>
      </div>

      <div className="home-menu">
        <button type="button" className="menu-btn btn-play" onClick={() => history.push('/start')}>
          Bắt đầu
        </button>
        <button type="button" className="menu-btn btn-rule" onClick={() => history.push('/rules')}>
          Luật lệ
        </button>
      </div>
    </div>
  );
};

export default HomePage;
