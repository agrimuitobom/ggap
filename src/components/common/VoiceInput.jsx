// src/components/common/VoiceInput.jsx
// テキスト入力欄に音声入力（Web Speech API）を追加するマイクボタン。
// 対応していないブラウザでは何も表示しない。認識したテキストは既存の値に
// 追記する。
import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';

const getRecognition = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  return recognition;
};

const VoiceInput = ({ value, onChange }) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  // 非対応ブラウザではボタンを出さない
  const supported = typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = getRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      const next = value ? `${value} ${text}` : text;
      onChange(next);
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        toast.error('マイクの使用が許可されていません');
      }
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    setListening(true);
    recognition.start();
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title="音声で入力"
      className={`shrink-0 px-3 py-2 rounded text-sm border ${
        listening
          ? 'bg-red-600 text-white border-red-600 animate-pulse'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
      }`}
    >
      {listening ? '● 録音中' : '🎤'}
    </button>
  );
};

export default VoiceInput;
