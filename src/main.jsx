import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from '@/context/AuthContext'
import { ShopProvider } from '@/context/ShopContext'
import { LanguageProvider } from '@/context/LanguageContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <ShopProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ShopProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
