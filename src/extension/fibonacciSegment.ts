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

import { OverlayTemplate } from 'klinecharts'

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
}

const fibonacciSegment: OverlayTemplate<any> = {
  name: 'fibonacciSegment',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: {
    point: {
      color: '#ffffff',
      borderColor: '#3b82f6',
      borderSize: 3,
      radius: 7,
      activeColor: '#ffffff',
      activeBorderColor: '#3b82f6',
      activeBorderSize: 5,
      activeRadius: 9
    }
  },
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

    if (coordinates.length > 1 && coordinates[0] && coordinates[1]) {
      // 1. Safely resolve prices for Point 0 and Point 1 even if points[1] is not yet in overlay.points during drawing
      const points = overlay.points || []
      const p0Val = typeof points[0]?.value === 'number'
        ? points[0].value
        : ((chart as any).convertFromPixel({ x: coordinates[0].x, y: coordinates[0].y }, { paneId: 'candle_pane' })?.value ?? 0)

      const p1Val = typeof points[1]?.value === 'number'
        ? points[1].value
        : ((chart as any).convertFromPixel({ x: coordinates[1].x, y: coordinates[1].y }, { paneId: 'candle_pane' })?.value ?? p0Val)

      const yDif = coordinates[0].y - coordinates[1].y
      const valueDif = p0Val - p1Val

      levels.forEach((level: FibLevel) => {
        if (!level.visible) return

        const percent = level.value
        const y = coordinates[1].y + yDif * percent
        const rawPrice = p1Val + valueDif * percent
        const price = typeof rawPrice === 'number' && !isNaN(rawPrice)
          ? rawPrice.toFixed(pricePrecision)
          : ''

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

    return figures
  }
}

export default fibonacciSegment
