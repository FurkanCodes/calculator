import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { App } from './App'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('renders the calculator and the docs beside it', () => {
  render(<App />)
  expect(screen.getByRole('heading', { name: 'Calculator' })).toBeDefined()
  expect(screen.getByRole('region', { name: 'Display' })).toBeDefined()
  expect(screen.getByRole('article', { name: 'About this calculator' })).toBeDefined()
  expect(screen.getByRole('link', { name: 'About' }).getAttribute('href')).toBe('#about')
})

it('leaves Enter on a docs link to the link, so it does not calculate', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<App />)

  for (const key of ['1', '+', '2']) {
    fireEvent.keyDown(document.body, { key })
  }
  const link = screen.getByRole('link', { name: /Swagger UI/ })
  link.focus()
  fireEvent.keyDown(link, { key: 'Enter' })

  expect(fetchMock).not.toHaveBeenCalled()
  expect(screen.getByTestId('expression').textContent).toBe('1 +')
})
