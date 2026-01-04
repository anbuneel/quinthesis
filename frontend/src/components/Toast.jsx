import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './Toast.css';

export default function Toast({ message, show, onClose, duration = 2500 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(onClose, 300); // Wait for fade-out animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show && !visible) return null;

  return createPortal(
    <div className={`toast ${visible ? 'toast-visible' : 'toast-hidden'}`}>
      <span className="toast-icon">✓</span>
      <span className="toast-message">{message}</span>
    </div>,
    document.body
  );
}
