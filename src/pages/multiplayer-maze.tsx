import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import { useMediaQuery } from 'react-responsive';
import { toast } from 'react-toastify';
import Canvas from '../components/canvas';
import Container from '../components/container';
import Nav from '../components/nav';
import QuestionModal from '../components/question-modal';
import Leaderboard from '../components/leaderboard';
import { IDLE_CONTROL, TOAST_CONFIG } from '../constants';
import getCanvasSize, { getOnKey, getOffKey } from '../lib/misc-util';
import MultiplayerGame from '../lib/multiplayer-game';
import { CallBack, Control, Gold, Player } from '../type';

const onGameOver: CallBack = (win) => {
  if (win) {
    toast.success('Congrats, You won the game 🚀', TOAST_CONFIG);
  } else {
    // Only show "Too Slow" if the user was actually playing
    // and not just joining a finished game
    const playerName = localStorage.getItem('playerName');
    if (playerName) {
      toast.error('Match Ended! Check the leaderboard.', TOAST_CONFIG);
    }
  }
};

const callBack: CallBack = (success, msg) => {
  if (success) toast.success(msg, TOAST_CONFIG);
  else toast.error(msg, TOAST_CONFIG);
};

const createOnLeave = (cleanUp: () => void) => {
  const onLeave = () => {
    cleanUp();
  };
  window.addEventListener('beforeunload', onLeave);
  window.addEventListener('pagehide', onLeave);
};

function MultiplayerMaze(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bigScreen = useMediaQuery({ query: '(min-width: 600px)' });
  const midScreen = useMediaQuery({ query: '(min-width: 400px)' });
  const [canvasSize, setCanvasSize] = useState(getCanvasSize(bigScreen, midScreen));
  const gameRef = useRef<MultiplayerGame>();
  const animationRef = useRef(0);
  const control = useRef<Control>(IDLE_CONTROL);
  const keyDirs = useRef(0);
  const [hitGold, setHitGold] = useState<Gold | null>(null);
  const [timeLeft, setTimeLeft] = useState(300);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [isGameOver, setIsGameOver] = useState(false);

  const onKey = getOnKey(keyDirs, control);
  const offKey = getOffKey(keyDirs, control);

  const hitGoldRef = useRef<Gold | null>(null);
  const [isFinished, setIsFinished] = useState(false);

  const animate: FrameRequestCallback = useCallback(() => {
    // Freeze movement if question modal is open
    if (!hitGoldRef.current) {
      gameRef.current?.performMove(control.current);
    }
    gameRef.current?.render();
    animationRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const game = new MultiplayerGame(
      canvasRef.current,
      (win) => {
        if (win) {
          setIsFinished(true);
        } else {
          const playerName = localStorage.getItem('playerName');
          if (playerName) {
            toast.error('Match Ended! Check the leaderboard.', TOAST_CONFIG);
          }
          setIsGameOver(true);
        }
      },
      callBack,
      (gold) => {
        hitGoldRef.current = gold;
        setHitGold(gold);
      },
      (seconds) => {
        setTimeLeft(seconds);
        if (seconds <= 0) setIsGameOver(true);
      }
    );
    gameRef.current = game;
    const playerName = localStorage.getItem('playerName');
    if (playerName) {
      game.enterGame(playerName);
    }

    const interval = setInterval(() => {
      if (gameRef.current) {
        setAllPlayers(gameRef.current.getPlayers());
      }
    }, 1000);

    createOnLeave(() => {
      clearInterval(interval);
      game.cleanUp();
    });
    return () => {
      clearInterval(interval);
      game.cleanUp();
    };
  }, []);

  useEffect(() => {
    setCanvasSize(getCanvasSize(bigScreen, midScreen));
  }, [bigScreen, midScreen]);

  useEffect(() => {
    animationRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationRef.current);
  }, [animate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <Nav />
      {/* Global Timer Overlay */}
      <div className="timer-overlay">
        <span className="timer-label">Time Left:</span>
        <span className="timer-value">{formatTime(timeLeft)}</span>
      </div>

      <div className="game-layout">
        <div className="maze-container-wrapper">
          <Container onKeyDown={onKey} onKeyUp={offKey}>
            <Canvas ref={canvasRef} size={canvasSize} />
          </Container>
        </div>

        <div className="live-leaderboard-wrapper">
          <Leaderboard
            players={allPlayers}
            title="Live Rankings"
            myUID={gameRef.current?.getMyPlayerId()}
          />
        </div>
      </div>
      {hitGold && (
        <QuestionModal
          gold={hitGold}
          onClose={() => {
            hitGoldRef.current = null;
            setHitGold(null);
          }}
          onAnswer={(correct) => {
            if (correct) {
              gameRef.current?.collectGold(hitGold);
              toast.success('Correct! Gold collected 💰', TOAST_CONFIG);
            } else {
              toast.error('Wrong answer! Try again later.', TOAST_CONFIG);
            }
            hitGoldRef.current = null;
            setHitGold(null);
          }}
        />
      )}

      {(isGameOver || isFinished) && (
        <div className="game-over-overlay">
          <Leaderboard
            players={allPlayers.filter((p) => p.finishTime)}
            title="Match Results"
            myUID={gameRef.current?.getMyPlayerId()}
          />
          <div className="mt-4 d-grid gap-2">
            <Button variant="warning" onClick={() => window.location.reload()}>
              Chơi lại
            </Button>
            <Button variant="outline-light" onClick={() => { localStorage.removeItem('playerName'); window.location.href = '#/'; }}>
              Thoát ra Menu
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default MultiplayerMaze;
