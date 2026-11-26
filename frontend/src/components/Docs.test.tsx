import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { Docs } from './Docs'

it('links to the Swagger UI, the OpenAPI description and the source, each in a new tab', () => {
  render(<Docs />)
  const links = [
    [/API docs \(Swagger UI\)/, '/docs/'],
    [/OpenAPI description/, '/api/v1/openapi.json'],
    [/Source on GitHub/, 'https://github.com/FurkanCodes/calculator'],
  ] as const
  for (const [name, href] of links) {
    const link = screen.getByRole('link', { name })
    expect(link.getAttribute('href')).toBe(href)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener')
    expect(link.textContent).toContain('(opens in a new tab)')
  }
})

it('has a section for using it and one for how it works', () => {
  render(<Docs />)
  const titles = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)
  expect(titles).toEqual(['Using it', 'How it works'])
})
