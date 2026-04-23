import React from 'react';
import { useHistory } from 'react-router-dom';
import './home-page.css';

const RULE_SECTIONS = [
  {
    title: 'Mục tiêu',
    points: [
      'Thu thập càng nhiều tài liệu càng tốt trong mê cung.',
      'Muốn chốt chiến thắng, bạn cần về đích sau khi đã có ít nhất 1 tài liệu.',
      'Nếu hết giờ, người có nhiều tài liệu hơn sẽ xếp trên.'
    ]
  },
  {
    title: 'Di chuyển',
    points: [
      'Dùng phím mũi tên hoặc WASD để điều khiển nhân vật.',
      'Bạn không thể đi xuyên tường, hệ thống sẽ tự chặn các bước đi không hợp lệ.',
      'Hãy quan sát và ghi nhớ đường đi vì bạn chỉ thấy vùng xung quanh mình.'
    ]
  },
  {
    title: 'Thu thập tài liệu',
    points: [
      'Khi chạm vào một tài liệu, câu hỏi trắc nghiệm sẽ hiện ra.',
      'Trả lời đúng để nhận tài liệu và tăng điểm.',
      'Mỗi tài liệu chỉ được tính cho người trả lời đúng đầu tiên.'
    ]
  },
  {
    title: 'Câu hỏi',
    points: [
      'Mỗi tài liệu đi kèm một câu hỏi 4 lựa chọn A, B, C, D.',
      'Trong lúc trả lời, bạn sẽ tạm dừng di chuyển.',
      'Nếu người khác trả lời đúng trước, tài liệu đó sẽ biến mất với tất cả mọi người.'
    ]
  },
  {
    title: 'Về đích và xếp hạng',
    points: [
      'Sau khi có tài liệu, hãy tìm đường về ô đích để chốt kết quả.',
      'Bảng xếp hạng hiển thị số tài liệu và trạng thái của từng người chơi theo thời gian thực.',
      'Nếu bằng điểm, người về đích sớm hơn sẽ có lợi thế hơn.'
    ]
  },
  {
    title: 'Thời gian trận đấu',
    points: [
      'Mỗi trận kéo dài 10 phút.',
      'Khi đồng hồ về 0, trận đấu kết thúc ngay.',
      'Lúc đó hệ thống sẽ hiện bảng kết quả cuối cùng.'
    ]
  }
];

const QUICK_TIPS = [
  'Ưu tiên nhặt tài liệu gần bạn trước để không bỏ lỡ cơ hội.',
  'Nếu mê cung đông người, đừng đứng quá lâu ở một câu hỏi khó.',
  'Sau khi có tài liệu đầu tiên, hãy bắt đầu nhớ đường về đích.'
];

const ITEM_RULES = [
  {
    type: 'torch',
    name: 'Đuốc',
    effect: 'Hiện đường chỉ dẫn (line vàng) đến đích trong 10 giây.',
    icon: '🔦',
    color: '#fbbf24'
  },
  {
    type: 'shield',
    name: 'Khiên',
    effect: 'Chặn 1 hiệu ứng xấu từ đối thủ. Tự động kích hoạt khi có.',
    icon: '🛡️',
    color: '#38bdf8'
  },
  {
    type: 'boom',
    name: 'Bom nổ',
    effect: 'Làm đối thủ nổ tung và mất 1 tài liệu. (Vật phẩm chọn mục tiêu)',
    icon: '💣',
    color: '#ef4444'
  },
  {
    type: 'net',
    name: 'Lưới',
    effect: 'Trói chân đối thủ trong 5 giây. (Vật phẩm chọn mục tiêu)',
    icon: '🕸️',
    color: '#94a3b8'
  },
  {
    type: 'flash',
    name: 'Bom mù',
    effect: 'Làm lóa mắt đối thủ trong 2 giây. (Vật phẩm chọn mục tiêu)',
    icon: '✨',
    color: '#fde047'
  },
  {
    type: 'smoke',
    name: 'Bom khói',
    effect: 'Che khuất tầm nhìn đối thủ trong 5 giây. (Vật phẩm chọn mục tiêu)',
    icon: '💨',
    color: '#64748b'
  },
  {
    type: 'banana',
    name: 'Vỏ chuối',
    effect: 'Bẫy trên bản đồ, dẫm phải sẽ bị đảo ngược điều khiển trong 10 giây.',
    icon: '🍌',
    color: '#fbbf24'
  }
];

const RulesPage: React.FC = () => {
  const history = useHistory();

  return (
    <div className="home-container rules-page-shell">
      <div className="rules-page-layout">
        <section className="rules-hero-panel">
          <span className="lobby-eyebrow">Hướng dẫn chơi</span>
          <h1 className="rules-page-title">Luật Chơi</h1>
          <p className="rules-page-lead">
            Đây là cuộc đua mê cung nhiều người chơi. Bạn cần vừa nhanh, vừa chính xác để thu
            thập tài liệu và về đích đúng lúc.
          </p>

          <div className="rules-highlight-grid">
            <div className="rules-highlight-card">
              <span className="rules-highlight-label">Thời gian</span>
              <strong className="rules-highlight-value">10 phút</strong>
            </div>
            <div className="rules-highlight-card">
              <span className="rules-highlight-label">Điều khiển</span>
              <strong className="rules-highlight-value">WASD / Mũi tên</strong>
            </div>
            <div className="rules-highlight-card">
              <span className="rules-highlight-label">Điều kiện thắng</span>
              <strong className="rules-highlight-value">Nhiều tài liệu + về đích</strong>
            </div>
          </div>
        </section>

        <section className="rules-main-panel">
          <div className="rules-section-list">
            {RULE_SECTIONS.map((section, index) => (
              <article key={section.title} className="rules-section-card">
                <div className="rules-section-number">{index + 1}</div>
                <div className="rules-section-body">
                  <h2 className="rules-section-title">{section.title}</h2>
                  <ul className="rules-points">
                    {section.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>

          <div className="rules-items-section">
            <h3 className="rules-section-title-large">Vật phẩm & Hiệu ứng</h3>
            <div className="rules-items-grid">
              {ITEM_RULES.map((item) => (
                <div key={item.type} className="rules-item-card">
                  <div className="rules-item-icon-wrap" style={{ backgroundColor: `${item.color}20`, borderColor: `${item.color}40` }}>
                    <span className="rules-item-icon">{item.icon}</span>
                  </div>
                  <div className="rules-item-info">
                    <h4 className="rules-item-name" style={{ color: item.color }}>{item.name}</h4>
                    <p className="rules-item-effect">{item.effect}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rules-tips-panel">
            <h3 className="rules-tips-title">Mẹo chơi nhanh</h3>
            <ul className="rules-points compact">
              {QUICK_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="rules-actions">
            <button type="button" className="menu-btn btn-play" onClick={() => history.push('/start')}>
              Vào trò chơi
            </button>
            <button type="button" className="menu-btn btn-rule" onClick={() => history.push('/')}>
              Quay lại menu
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default RulesPage;
