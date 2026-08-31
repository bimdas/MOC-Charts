/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { OverlayTemplate, Chart } from 'klinecharts'

interface FibLevel {
  value: number
  color: string
  visible: boolean
}

interface FibExtendData {
  levels?: FibLevel[]
  extendLeft?: boolean
  extendRight?: boolean
  labelAlignment?: 'left' | 'center' | 'right'
  labelPosition?: 'top' | 'middle' | 'bottom'
  p1Snap?: string
  p2Snap?: string
  isSelected?: boolean
}

const snapToCandle = (chart: Chart, performPoint: any, performPointIndex: number, extendData: FibExtendData) => {
  try {
    const dataList = chart.getDataList()
    if (!dataList || dataList.length === 0) return

    let candle: any = null
    if (performPoint.dataIndex !== undefined && dataList[performPoint.dataIndex]) {
      candle = dataList[performPoint.dataIndex]
    } else if (performPoint.timestamp !== undefined) {
      candle = dataList.find(d => d.timestamp === performPoint.timestamp)
    }

    if (!candle && dataList.length > 0) {
      candle = dataList[dataList.length - 1]
    }

    if (candle && typeof performPoint.value === 'number') {
      const val = performPoint.value
      const high = candle.high
      const low = candle.low
      const open = candle.open
      const close = candle.close

      const range = Math.abs(high - low)
      const tolerance = Math.max(range * 0.25, val * 0.0012)

      let snapLabel = ''
      if (Math.abs(val - high) <= tolerance) {
        performPoint.value = high
        snapLabel = 'High'
      } else if (Math.abs(val - low) <= tolerance) {
        performPoint.value = low
        snapLabel = 'Low'
      } else if (Math.abs(val - open) <= tolerance * 0.6) {
        performPoint.value = open
        snapLabel = 'Open'
      } else if (Math.abs(val - close) <= tolerance * 0.6) {
        performPoint.value = close
        snapLabel = 'Close'
      }

      if (performPointIndex === 0) {
        extendData.p1Snap = snapLabel
      } else if (performPointIndex === 1) {
        extendData.p2Snap = snapLabel
      }
    }
  } catch (_) {}
}

const fibonacciSegment: OverlayTemplate<any> = {
  name: 'fibonacciSegment',
  totalStep: 3,
  needDefaultPointFigure: false,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ chart, coordinates, overlay, bounding }) => {
    const figures: any[] = []
    const pricePrecision = chart.getSymbol()?.pricePrecision ?? 2

    const hardcodedDefaults: FibExtendData = {
      levels: [
        { value: 0, color: '#787B86', visible: true },
        { value: 0.236, color: '#F23645', visible: true },
        { value: 0.382, color: '#FF9800', visible: true },
        { value: 0.5, color: '#4CAF50', visible: true },
        { value: 0.618, color: '#089981', visible: true },
        { value: 0.786, color: '#2962FF', visible: true },
        { value: 1, color: '#9C27B0', visible: true }
      ],
      extendLeft: false,
      extendRight: false,
      labelAlignment: 'right',
      labelPosition: 'top'
    }

    let defaultExtendData = hardcodedDefaults
    try {
      const saved = localStorage.getItem('klinecharts_fib_last_settings')
      if (saved) defaultExtendData = JSON.parse(saved)
    } catch (e) { }

    const extendData: FibExtendData = overlay.extendData || defaultExtendData
    const levels = extendData.levels || defaultExtendData.levels || []

    const isDrawing = typeof overlay.currentStep === 'number' && typeof overlay.totalStep === 'number' && overlay.currentStep < overlay.totalStep
    const ovAny = overlay as any
    const isSelected = Boolean(
      isDrawing ||
      ovAny.isSelected ||
      ovAny.isHover ||
      ovAny.isPressed ||
      ovAny.selected ||
      ovAny.hover ||
      extendData.isSelected
    )

    if (coordinates.length > 0) {
      // 1. Temporary Dynamic Alignment Guides (Crosshair projection rays) - ONLY when selected/active
      if (isSelected) {
        figures.push({
          type: 'line',
          attrs: { coordinates: [{ x: 0, y: coordinates[0].y }, { x: bounding.width, y: coordinates[0].y }] },
          styles: { style: 'dashed', dashedValue: [3, 3], color: 'rgba(59, 130, 246, 0.4)', size: 1 }
        })
        figures.push({
          type: 'line',
          attrs: { coordinates: [{ x: coordinates[0].x, y: 0 }, { x: coordinates[0].x, y: bounding.height }] },
          styles: { style: 'dashed', dashedValue: [3, 3], color: 'rgba(59, 130, 246, 0.4)', size: 1 }
        })

        if (coordinates.length > 1) {
          // Horizontal & Vertical guide rays for Point 2
          figures.push({
            type: 'line',
            attrs: { coordinates: [{ x: 0, y: coordinates[1].y }, { x: bounding.width, y: coordinates[1].y }] },
            styles: { style: 'dashed', dashedValue: [3, 3], color: 'rgba(59, 130, 246, 0.4)', size: 1 }
          })
          figures.push({
            type: 'line',
            attrs: { coordinates: [{ x: coordinates[1].x, y: 0 }, { x: coordinates[1].x, y: bounding.height }] },
            styles: { style: 'dashed', dashedValue: [3, 3], color: 'rgba(59, 130, 246, 0.4)', size: 1 }
          })

          // 2. Trend Connector Baseline Vector between Point 1 and Point 2
          figures.push({
            type: 'line',
            attrs: { coordinates: [coordinates[0], coordinates[1]] },
            styles: { style: 'dashed', dashedValue: [4, 4], color: '#3b82f6', size: 1.5 }
          })
        }
      }

      // 3. Fibonacci Retracement Levels (Always rendered if 2 points exist)
      if (coordinates.length > 1) {
        const yDif = coordinates[0].y - coordinates[1].y
        const points = overlay.points
        // @ts-expect-error
        const valueDif = points[0].value - points[1].value

        levels.forEach((level: FibLevel) => {
          if (!level.visible) return

          const percent = level.value
          const y = coordinates[1].y + yDif * percent
          // @ts-expect-error
          const price = (points[1].value + valueDif * percent).toFixed(pricePrecision)

          let startX = coordinates[0].x
          let endX = coordinates[1].x

          if (extendData.extendLeft) {
            if (startX < endX) startX = 0; else endX = 0
          }
          if (extendData.extendRight) {
            const width = bounding.width
            if (startX > endX) startX = width; else endX = width
          }

          let textX = startX > endX ? startX : endX
          let textAlign: 'left' | 'center' | 'right' = 'left'

          if (extendData.labelAlignment === 'left') {
            textX = startX < endX ? startX : endX
            textAlign = 'left'
          } else if (extendData.labelAlignment === 'center') {
            textX = (startX + endX) / 2
            textAlign = 'center'
          } else {
            textX = startX > endX ? startX : endX
            textAlign = 'right'
          }

          let textBaseline: 'top' | 'middle' | 'bottom' = 'bottom'
          if (extendData.labelPosition === 'top') {
            textBaseline = 'bottom'
          } else if (extendData.labelPosition === 'middle') {
            textBaseline = 'middle'
          } else if (extendData.labelPosition === 'bottom') {
            textBaseline = 'top'
          }

          figures.push({
            type: 'line',
            attrs: { coordinates: [{ x: startX, y }, { x: endX, y }] },
            styles: { style: 'solid', color: level.color }
          })

          figures.push({
            type: 'text',
            ignoreEvent: true,
            attrs: {
              x: textX,
              y,
              text: `${price} (${(percent * 100).toFixed(1)}%)`,
              align: textAlign,
              baseline: textBaseline
            },
            styles: {
              color: level.color,
              paddingLeft: 0,
              paddingRight: 0,
              paddingTop: 0,
              paddingBottom: 0,
              backgroundColor: 'transparent',
              borderColor: 'transparent'
            }
          })
        })
      }

      // 4. Dual-Layer Touch Grab Handles - ONLY when selected/active
      if (isSelected) {
        coordinates.forEach((coord) => {
          // Outer interactive touch halo
          figures.push({
            type: 'circle',
            attrs: { ...coord, r: 13 },
            styles: {
              style: 'stroke_fill',
              color: 'rgba(59, 130, 246, 0.22)',
              borderColor: '#3b82f6',
              borderSize: 1.5
            }
          })
          // Inner white core dot
          figures.push({
            type: 'circle',
            attrs: { ...coord, r: 4 },
            styles: {
              style: 'fill',
              color: '#ffffff'
            }
          })
        })

        // 5. Floating Finger-Offset Price / Snap Callout Badges
        const p1Val = overlay.points[0]?.value
        if (typeof p1Val === 'number') {
          const p1SnapText = extendData.p1Snap ? ` [🎯 ${extendData.p1Snap}]` : ''
          figures.push({
            type: 'text',
            ignoreEvent: true,
            attrs: {
              x: coordinates[0].x,
              y: Math.max(16, coordinates[0].y - 20),
              text: `P1: ${p1Val.toFixed(pricePrecision)}${p1SnapText}`,
              align: 'center',
              baseline: 'bottom'
            },
            styles: {
              color: '#ffffff',
              backgroundColor: '#151924',
              borderColor: '#3b82f6',
              borderSize: 1,
              borderRadius: 4,
              paddingLeft: 6,
              paddingRight: 6,
              paddingTop: 2,
              paddingBottom: 2,
              size: 11,
              family: 'Inter, sans-serif'
            }
          })
        }

        if (coordinates.length > 1) {
          const p2Val = overlay.points[1]?.value
          if (typeof p2Val === 'number') {
            const p2SnapText = extendData.p2Snap ? ` [🎯 ${extendData.p2Snap}]` : ''
            figures.push({
              type: 'text',
              ignoreEvent: true,
              attrs: {
                x: coordinates[1].x,
                y: Math.max(16, coordinates[1].y - 20),
                text: `P2: ${p2Val.toFixed(pricePrecision)} (100%)${p2SnapText}`,
                align: 'center',
                baseline: 'bottom'
              },
              styles: {
                color: '#ffffff',
                backgroundColor: '#151924',
                borderColor: '#3b82f6',
                borderSize: 1,
                borderRadius: 4,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 2,
                paddingBottom: 2,
                size: 11,
                family: 'Inter, sans-serif'
              }
            })
          }
        }
      }
    }

    return figures
  },
  performEventPressedMove: ({ chart, points, performPointIndex, performPoint, overlay }: any) => {
    if (!overlay.extendData) overlay.extendData = {}
    overlay.extendData.isSelected = true
    snapToCandle(chart, performPoint, performPointIndex, overlay.extendData)
  },
  performEventMoveForDrawing: ({ chart, points, performPointIndex, performPoint, overlay }: any) => {
    if (!overlay.extendData) overlay.extendData = {}
    overlay.extendData.isSelected = true
    snapToCandle(chart, performPoint, performPointIndex, overlay.extendData)
  }
}

export default fibonacciSegment
