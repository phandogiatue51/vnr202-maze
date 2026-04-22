/* eslint-disable react/prop-types */
import React from 'react';
import { Gold } from '../type';
import './question-modal.css';

interface QuestionModalProps {
  gold: Gold;
  onAnswer: (correct: boolean) => void;
  onClose: () => void;
}

const QuestionModal: React.FC<QuestionModalProps> = ({ gold, onAnswer, onClose }) => {
  const { question } = gold;
  const [selectedChoice, setSelectedChoice] = React.useState<string | null>(null);
  const [isRevealing, setIsRevealing] = React.useState(false);
  const [feedback, setFeedback] = React.useState<'correct' | 'incorrect' | null>(null);

  const handleChoice = (choiceKey: string) => {
    if (isRevealing) return;

    setSelectedChoice(choiceKey);
    setIsRevealing(true);

    const isCorrect = choiceKey === question.answer;

    setTimeout(() => {
      setFeedback(isCorrect ? 'correct' : 'incorrect');

      if (isCorrect) {
        setTimeout(() => {
          onAnswer(true);
        }, 1000);
      } else {
        setTimeout(() => {
          onAnswer(false);
        }, 3000);
      }
    }, 2000);
  };

  return (
    <div className="modal-backdrop">
      <div className="question-card">
        <div className="gold-icon-header">
          <span className="header-icon">✨</span>
          <span className="header-text">Thử thách tài liệu</span>
        </div>

        <h2 className="question-text">{question.text}</h2>

        <div className="options-grid">
          {question.options.map((option, index) => {
            const key = String.fromCharCode(65 + index);
            const isSelected = selectedChoice === key;
            const isCorrect = key === question.answer;

            let statusClass = '';
            if (isRevealing) {
              if (isSelected) {
                statusClass =
                  feedback === 'correct'
                    ? 'option-correct'
                    : feedback === 'incorrect'
                      ? 'option-incorrect'
                      : 'option-selected';
              } else if (feedback === 'incorrect' && isCorrect) {
                statusClass = 'option-correct-revealed';
              }
            }

            return (
              <button
                type="button"
                key={key}
                className={`option-button ${statusClass}`}
                onClick={() => handleChoice(key)}
                disabled={isRevealing}
              >
                <span className="option-key">{key}</span>
                <span className="option-content">{option}</span>
              </button>
            );
          })}
        </div>

        <button type="button" className="close-btn" onClick={onClose}>
          Bỏ qua lúc này
        </button>
      </div>
    </div>
  );
};

export default QuestionModal;
