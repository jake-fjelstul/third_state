import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Shell } from './components/Shell'
import { Overview } from './pages/Overview'
import { Growth } from './pages/Growth'
import { Onboarding } from './pages/Onboarding'
import { Circles } from './pages/Circles'
import { Events } from './pages/Events'
import { Connections } from './pages/Connections'
import { Moderation } from './pages/Moderation'

export function App() {
  const [period, setPeriod] = useState(30)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  return (
    <BrowserRouter>
      <AuthGate>
        <Shell>
          <Routes>
            <Route
              path="/"
              element={
                <Overview
                  period={period}
                  onPeriodChange={setPeriod}
                  onRefresh={handleRefresh}
                  key={`overview-${refreshTrigger}`}
                />
              }
            />
            <Route
              path="/growth"
              element={
                <Growth
                  period={period}
                  onPeriodChange={setPeriod}
                  onRefresh={handleRefresh}
                  key={`growth-${refreshTrigger}`}
                />
              }
            />
            <Route
              path="/onboarding"
              element={
                <Onboarding
                  onRefresh={handleRefresh}
                  key={`onboarding-${refreshTrigger}`}
                />
              }
            />
            <Route
              path="/circles"
              element={
                <Circles
                  onRefresh={handleRefresh}
                  key={`circles-${refreshTrigger}`}
                />
              }
            />
            <Route
              path="/events"
              element={
                <Events
                  period={period}
                  onPeriodChange={setPeriod}
                  onRefresh={handleRefresh}
                  key={`events-${refreshTrigger}`}
                />
              }
            />
            <Route
              path="/connections"
              element={
                <Connections
                  onRefresh={handleRefresh}
                  key={`connections-${refreshTrigger}`}
                />
              }
            />
            <Route
              path="/moderation"
              element={
                <Moderation
                  onRefresh={handleRefresh}
                  key={`moderation-${refreshTrigger}`}
                />
              }
            />
          </Routes>
        </Shell>
      </AuthGate>
    </BrowserRouter>
  )
}

export default App
