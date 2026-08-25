import { render, screen, cleanup } from '@testing-library/react'
import { MetricCard } from './MetricCard'

describe('MetricCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the title and the current value rounded to a whole-number percent', () => {
    render(<MetricCard title="CPU" current={45.6} history={[10, 20, 45.6]} error={false} />)

    expect(screen.getByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('46%')).toBeInTheDocument()
  })

  it('renders a sparkline graph when history has more than one point', () => {
    render(<MetricCard title="CPU" current={20} history={[10, 20, 30]} error={false} />)

    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument()
  })

  it('shows a "not enough data yet" message when history is null', () => {
    render(<MetricCard title="CPU" current={0} history={null} error={false} />)

    expect(screen.getByText('Накопление данных…')).toBeInTheDocument()
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument()
  })

  it('shows a "not enough data yet" message when history has only one point', () => {
    render(<MetricCard title="CPU" current={10} history={[10]} error={false} />)

    expect(screen.getByText('Накопление данных…')).toBeInTheDocument()
    expect(screen.queryByRole('img', { hidden: true })).not.toBeInTheDocument()
  })

  it('shows an error message instead when error is true and history is null', () => {
    render(<MetricCard title="CPU" current={0} history={null} error={true} />)

    expect(screen.getByText('Не удалось загрузить историю')).toBeInTheDocument()
    expect(screen.queryByText('Накопление данных…')).not.toBeInTheDocument()
  })

  it('shows an error message instead when error is true and history has only one point', () => {
    render(<MetricCard title="CPU" current={10} history={[10]} error={true} />)

    expect(screen.getByText('Не удалось загрузить историю')).toBeInTheDocument()
  })

  it('still renders the graph (ignoring the error flag) when there is usable history', () => {
    render(<MetricCard title="CPU" current={20} history={[10, 20, 30]} error={true} />)

    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument()
    expect(screen.queryByText('Не удалось загрузить историю')).not.toBeInTheDocument()
  })

  it('renders min/max figures derived from the given history', () => {
    render(<MetricCard title="CPU" current={20} history={[5, 50, 20]} error={false} />)

    expect(screen.getByText('мин 5%')).toBeInTheDocument()
    expect(screen.getByText('макс 50%')).toBeInTheDocument()
  })
})
