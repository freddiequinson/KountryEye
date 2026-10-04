// Thin ApexCharts wrappers with the Horizon look (replaces recharts).
import Chart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import { useColorMode } from '@chakra-ui/react'

export const CHART_COLORS = ['#4C9B4F', '#0CC0DF', '#FFB547', '#EE5D50', '#7551FF', '#01B574', '#3965FF', '#A3AED0']

type Formatter = (value: number) => string

function useBaseOptions(): ApexOptions {
  const { colorMode } = useColorMode()
  return {
    chart: { toolbar: { show: false }, fontFamily: 'DM Sans, sans-serif', background: 'transparent', foreColor: colorMode === 'dark' ? '#A3AED0' : '#707EAE' },
    theme: { mode: colorMode },
    colors: CHART_COLORS,
    grid: { borderColor: colorMode === 'dark' ? 'rgba(255,255,255,0.08)' : '#E2E8F0', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    legend: { position: 'bottom' },
    tooltip: { theme: colorMode },
  }
}

export function PieChart({ labels, values, height = 256, formatter }: { labels: string[]; values: number[]; height?: number; formatter?: Formatter }) {
  const base = useBaseOptions()
  const options: ApexOptions = {
    ...base,
    labels,
    dataLabels: { enabled: true, formatter: (pct: number) => `${pct.toFixed(0)}%` },
    tooltip: { ...base.tooltip, y: formatter ? { formatter } : undefined },
    stroke: { width: 0 },
  }
  return <Chart type="pie" series={values} options={options} height={height} />
}

export function BarChart({
  categories,
  series,
  horizontal,
  height = 256,
  formatter,
  distributed,
  colors,
}: {
  categories: string[]
  series: { name: string; data: number[] }[]
  horizontal?: boolean
  height?: number
  formatter?: Formatter
  distributed?: boolean
  colors?: string[]
}) {
  const base = useBaseOptions()
  const options: ApexOptions = {
    ...base,
    colors: colors || base.colors,
    plotOptions: { bar: { horizontal, borderRadius: 6, columnWidth: '45%', barHeight: '60%', distributed } },
    xaxis: { categories, labels: horizontal && formatter ? { formatter: (v: string) => formatter(Number(v)) } : undefined },
    yaxis: { labels: { formatter: !horizontal && formatter ? formatter : undefined, maxWidth: 140 } },
    tooltip: { ...base.tooltip, y: formatter ? { formatter } : undefined },
    legend: { ...base.legend, show: series.length > 1 },
  }
  return <Chart type="bar" series={series} options={options} height={height} />
}

// Two-series area chart with independent left/right axes (e.g. visits vs revenue).
export function DualAreaChart({
  categories,
  left,
  right,
  height = 320,
}: {
  categories: string[]
  left: { name: string; data: number[]; formatter?: Formatter }
  right: { name: string; data: number[]; formatter?: Formatter }
  height?: number
}) {
  const base = useBaseOptions()
  const options: ApexOptions = {
    ...base,
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0 } },
    xaxis: { categories },
    yaxis: [
      { title: { text: left.name }, labels: { formatter: left.formatter } },
      { opposite: true, title: { text: right.name }, labels: { formatter: right.formatter } },
    ],
    tooltip: { ...base.tooltip, shared: true },
  }
  return <Chart type="area" series={[left, right].map(({ name, data }) => ({ name, data }))} options={options} height={height} />
}
