import { render, screen, within } from '@testing-library/react'
import HelpPage from '../pages/HelpPage'

describe('HelpPage - "Первые шаги" numbered list', () => {
  it('renders the "Первые шаги" ordered list with visible decimal numbering (not the Tailwind-preflight-stripped "none")', () => {
    render(<HelpPage />)

    const heading = screen.getByRole('heading', { name: 'Первые шаги' })
    const section = heading.closest('section')
    expect(section).not.toBeNull()

    const list = section!.querySelector('ol')
    expect(list).not.toBeNull()

    // Tailwind's preflight reset strips ol/ul to `list-style: none` by
    // default. The fix restores visible "1./2./3." markers by explicitly
    // setting listStyleType to 'decimal' in the ol's inline style, rather
    // than only fixing the indentation.
    expect(list).toHaveStyle({ listStyleType: 'decimal' })
    expect(list!.style.listStyleType).not.toBe('none')
    expect(list!.style.listStyleType).not.toBe('')
  })

  it('renders the three "Первые шаги" step items, in order, inside that ordered list', () => {
    render(<HelpPage />)

    const heading = screen.getByRole('heading', { name: 'Первые шаги' })
    const section = heading.closest('section')
    const list = section!.querySelector('ol') as HTMLOListElement

    const items = within(list).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('Войди через форму входа Schlüssel (единая для всей платформы).')
    expect(items[1]).toHaveTextContent('На главной странице Schloss увидишь карточки доступных сервисов.')
    expect(items[2]).toHaveTextContent('Открой нужный сервис, нажав на его карточку.')
  })
})
