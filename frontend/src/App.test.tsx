import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { App } from './App'

it('renders the calculator', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Calculator' })).toBeDefined()
  expect(screen.getByRole('region', { name: 'Display' })).toBeDefined()
})
