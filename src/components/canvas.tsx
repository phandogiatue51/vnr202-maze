import React, { KeyboardEventHandler, LegacyRef } from 'react';

interface CanvasProps {
  onKeyDown?: KeyboardEventHandler<HTMLCanvasElement>;
  onKeyUp?: KeyboardEventHandler<HTMLCanvasElement>;
  size: number;
  className?: string;
}

const Canvas = React.forwardRef(
  (props: CanvasProps, ref: LegacyRef<HTMLCanvasElement>): JSX.Element => {
    const { size, onKeyUp, onKeyDown, className } = props;
    return (
      <canvas
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        ref={ref}
        width={size}
        height={size}
        className={className || 'bg-white'}
      />
    );
  }
);

Canvas.defaultProps = {
  onKeyDown: () => true,
  onKeyUp: () => true,
  className: 'bg-white'
};

export default Canvas;
