
import React, { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element (#root) not found in index.html')
}

// Ortamı güvenli şekilde algıla (Vite/CRA uyumlu)
const isDev =
  (typeof import.meta !== 'undefined' && import.meta.env?.DEV) ||
  (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production')

// Geliştirmede StrictMode, üretimde Fragment
const Wrapper = isDev ? StrictMode : React.Fragment

createRoot(rootElement).render(
  <Wrapper>
    <Suspense fallback={<div>Yükleniyor…</div>}>
      <App />
    </Suspense>
  </Wrapper>,
)