import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '../table_tech_multi_business_revenue_tracker_react.tsx'
// import { runMigrations } from './lib/migrations'

// Temporarily disabled migrations
// runMigrations().catch(console.error);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)