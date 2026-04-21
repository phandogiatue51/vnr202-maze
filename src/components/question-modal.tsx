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
    
    // Give 2 seconds to show the answer status
    setTimeout(() => {
      setFeedback(isCorrect ? 'correct' : 'incorrect');
      
      if (isCorrect) {
        // After 2 seconds of showing it's correct, finish
        setTimeout(() => {
          onAnswer(true);
        }, 1000);
      } else {
        // If incorrect, wait for 5 seconds (including the reveal time)
        // User said "wait for 5 seconds", I'll wait 3 more seconds here (total 5 since start)
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
          <span className="header-text">Gold Challenge!</span>
        </div>

        <h2 className="question-text">{question.text}</h2>

        <div className="options-grid">
          {question.options.map((option, index) => {
            const key = String.fromCharCode(65 + index); // A, B, C, D
            const isSelected = selectedChoice === key;
            const isCorrect = key === question.answer;
            
            let statusClass = '';
            if (isRevealing) {
              if (isSelected) {
                statusClass = feedback === 'correct' ? 'option-correct' : (feedback === 'incorrect' ? 'option-incorrect' : 'option-selected');
              } else if (feedback === 'incorrect' && isCorrect) {
                // Show correct answer if they were wrong
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
          Skip for now
        </button>
      </div>
    </div>
  );
};

export default QuestionModal;
