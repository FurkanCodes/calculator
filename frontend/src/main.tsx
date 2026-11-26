import { CSPProvider } from '@base-ui/react/csp-provider'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

const root = document.getElementById('root')
if (root === null) {
  throw new Error('index.html has no #root element')
}

// nginx's Content Security Policy allows no inline styles, so Base UI must not
// add its own <style> element. index.css has the rules it would have added.
createRoot(root).render(
  <StrictMode>
    <CSPProvider disableStyleElements>
      <App />
    </CSPProvider>
  </StrictMode>,
)
