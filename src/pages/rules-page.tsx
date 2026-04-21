import React from 'react';
import { useHistory } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import './home-page.css';

const RulesPage: React.FC = () => {
  const history = useHistory();

  return (
    <Container className="home-container" style={{ textAlign: 'left' }}>
      <div
        className="rules-content p-4"
        style={{
          background: '#1e293b',
          borderRadius: '20px',
          border: '2px solid #fbbf24',
          maxWidth: '800px'
        }}
      >
        <h1 className="game-title text-center" style={{ fontSize: '3rem' }}>
          Luật Chơi
        </h1>

        <h3>1. Mục tiêu</h3>
        <p>
          Người chơi đầu tiên thu thập được nhiều vàng nhất VÀ về đích thành công sẽ giành chiến
          thắng.
        </p>

        <h3>2. Di chuyển</h3>
        <p>
          Sử dụng các phím mũi tên (↑ ↓ ← →) hoặc phím WASD (W A S D) để di chuyển nhân vật trong mê
          cung. Bạn không thể đi xuyên tường.
        </p>

        <h3>3. Thu thập vàng</h3>
        <p>
          Có 50 cục vàng được đặt cố định. Đứng vào ô có vàng để trả lời câu hỏi trắc nghiệm. Trả
          lời đúng để nhận vàng.
        </p>

        <h3>4. Về đích</h3>
        <p>
          Bạn phải về đích sau khi đã thu thập được ít nhất 1 cục vàng. Trạng thái về đích sẽ được
          ghi nhận trên bảng xếp hạng.
        </p>

        <h3>5. Thời gian</h3>
        <p>Mỗi ván đấu kéo dài 10 phút. Hết giờ, ai nhiều vàng nhất sẽ giành chiến thắng.</p>

        <div className="text-center mt-5">
          <button type="button" className="menu-btn btn-play" onClick={() => history.push('/')}>
            Quay lại Menu
          </button>
        </div>
      </div>
    </Container>
  );
};

export default RulesPage;
