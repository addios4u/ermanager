import './i18n'; // i18n 초기화 — React 렌더링 전에 반드시 먼저 실행
import React from 'react';
import { createRoot } from 'react-dom/client';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import App from './App';

// Monaco: CDN 대신 로컬 번들 사용 + 빈 워커 (CSP 호환)
(window as any).MonacoEnvironment = {
  getWorker(_id: string, _label: string) {
    return new Worker(
      URL.createObjectURL(new Blob(['self.onmessage=function(){}'], { type: 'text/javascript' }))
    );
  },
};
loader.config({ monaco });

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
