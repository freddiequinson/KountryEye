// Thin ApexCharts wrappers with the Horizon look (replaces recharts).
import Chart from 'react-apexcharts'
import type { ApexOptions } from 'apexcharts'
import { Center, Icon, Text, useColorMode } from '@chakra-ui/react'
import { MdInsights } from 'react-icons/md'

export const CHART_COLORS = ['#4C9B4F', '#0CC0DF', '#FFB547', '#EE5D50', '#7551FF', '#01B574', '#3965FF', '#A3AED0']

type Formatter = (value: number) => string

function useBaseOptions(): ApexOptions {
  const { colorMode } = useColorMode()
  return {
    chart: { toolbar: { show: false }, fontFamily: 'Plus Jakarta Sans, sans-serif', background: 'transparent', foreColor: colorMode === 'dark' ? '#A3AED0' : '#64748B' },
    theme: { mode: colorMode },
    colors: CHART_COLORS,
    grid: { borderColor: colorMode === 'dark' ? 'rgba(255,255,255,0.08)' : '#E4E9F0', strokeDashArray: 4 },
    dataLabels: { enabled: false },
    legend: { position: 'bottom', fontWeight: 600, markers: { size: 5 }, itemMargin: { horizontal: 10 } },
    tooltip: { theme: colorMode },
  }
}

function NoData({ height }: { height: number }) {
  return (
    <Center h={`${height}px`} flexDirection="column" gap="6px" color="secondaryGray.500">
      <Icon as={MdInsights} w="28px" h="28px" opacity={0.6} />
      <Text fontSize="sm" fontWeight="500">
        No data for this period
      </Text>
    </Center>
  )
}

export function PieChart({ labels, values, height = 256, formatter }: { labels: string[]; values: number[]; height?: number; formatter?: Formatter }) {
  const base = useBaseOptions()
  const { colorMode } = useColorMode()
  const options: ApexOptions = {
    ...base,
    labels,
    dataLabels: { enabled: true, formatter: (pct: number) => `${pct.toFixed(0)}%`, dropShadow: { enabled: false }, style: { fontSize: '12px', fontWeight: 700 } },
    plotOptions: { pie: { donut: { size: '62%' }, expandOnClick: false } },
    tooltip: { ...base.tooltip, ...(formatter ? { y: { formatter } } : {}) },
    stroke: { width: 3, colors: [colorMode === 'dark' ? '#111C44' : '#ffffff'] },
  }
  if (!values.some((v) => v > 0)) return <NoData height={height} />
  return <Chart type="donut" series={values} options={options} height={height} />
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
    xaxis: { categories, ...(horizontal && formatter ? { labels: { formatter: (v: string) => formatter(Number(v)) } } : {}) },
    yaxis: { labels: { maxWidth: 140, ...(!horizontal && formatter ? { formatter } : {}) } },
    tooltip: { ...base.tooltip, ...(formatter ? { y: { formatter } } : {}) },
    legend: { ...base.legend, show: series.length > 1 },
  }
  if (!categories.length) return <NoData height={height} />
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
    stroke: { curve: 'smooth', width: 2.5 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0 } },
    // at most ~8 date labels, kept horizontal
    xaxis: { categories, tickAmount: Math.min(8, categories.length), labels: { rotate: 0, hideOverlappingLabels: true }, axisBorder: { show: false }, axisTicks: { show: false }, tooltip: { enabled: false } },
    yaxis: [
      { min: 0, forceNiceScale: true, decimalsInFloat: 0, labels: left.formatter ? { formatter: left.formatter } : {} },
      { opposite: true, min: 0, forceNiceScale: true, labels: right.formatter ? { formatter: right.formatter } : {} },
    ],
    tooltip: { ...base.tooltip, shared: true },
  }
  return <Chart type="area" series={[left, right].map(({ name, data }) => ({ name, data }))} options={options} height={height} />
}
