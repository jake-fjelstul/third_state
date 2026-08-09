import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { Shell } from './components/Shell'
import { Overview } from './pages/Overview'
import { Growth } from './pages/Growth'
import { Onboarding } from './pages/Onboarding'
import { Panel } from './components/ui/Panel'

function PlaceholderPage({ title }) {
  return (
    <Panel title={title.toUpperCase()}>
      <div className="py-12 text-center">
        <p className="font-body text-sm text-muted">Coming in the next pass.</p>
      </div>
    </Panel>
  )
}

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
            <Route path="/circles" element={<PlaceholderPage title="Circles" />} />
            <Route path="/events" element={<PlaceholderPage title="Events" />} />
            <Route path="/connections" element={<PlaceholderPage title="Connections" />} />
            <Route path="/moderation" element={<PlaceholderPage title="Moderation" />} />
          </Routes>
        </Shell>
      </AuthGate>
    </BrowserRouter>
  )
}

export default App
