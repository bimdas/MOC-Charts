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

import { OverlayTemplate, utils } from 'klinecharts'

const ruler: OverlayTemplate = {
  name: 'ruler',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: {
    polygon: {
      color: 'rgba(22, 119, 255, 0.15)'
    },
    line: {
      // @ts-expect-error
      style: 'dashed',
      dashValue: [2, 2],
      color: '#1677FF'
    },
    text: {
      color: '#FFFFFF',
      // @ts-expect-error
      backgroundColor: '#1677FF',
      size: 12,
      paddingLeft: 8,
      paddingRight: 8,
      paddingTop: 6,
      paddingBottom: 6,
      borderRadius: 4
    }
  },
  createPointFigures: ({ coordinates, overlay, precision }) => {
    const figures: any[] = []
    if (coordinates.length > 1) {
      const p1 = coordinates[0]
      const p2 = coordinates[1]
      
      const points = overlay.points
      const value1 = points[0]?.value ?? 0
      const value2 = points[1]?.value ?? 0
      const index1 = points[0]?.dataIndex ?? 0
      const index2 = points[1]?.dataIndex ?? 0
      const t1 = points[0]?.timestamp ?? 0
      const t2 = points[1]?.timestamp ?? 0
      
      // Shaded area
      figures.push({
        type: 'polygon',
        attrs: {
          coordinates: [
            p1,
            { x: p2.x, y: p1.y },
            p2,
            { x: p1.x, y: p2.y }
          ]
        },
        styles: { style: 'fill' }
      })

      // Cross lines with arrows
      figures.push({
        type: 'line',
        attrs: { coordinates: [{ x: p1.x, y: (p1.y + p2.y) / 2 }, { x: p2.x, y: (p1.y + p2.y) / 2 }] }
      })
      figures.push({
        type: 'line',
        attrs: { coordinates: [{ x: (p1.x + p2.x) / 2, y: p1.y }, { x: (p1.x + p2.x) / 2, y: p2.y }] }
      })

      // Arrows
      const arrowSize = 6
      const midY = (p1.y + p2.y) / 2
      const midX = (p1.x + p2.x) / 2
      
      // Horizontal arrow (right)
      figures.push({
        type: 'line',
        attrs: {
          coordinates: [
            { x: p2.x - arrowSize, y: midY - arrowSize },
            { x: p2.x, y: midY },
            { x: p2.x - arrowSize, y: midY + arrowSize }
          ]
        },
        styles: { style: 'solid' }
      })
      
      // Vertical arrow (depends on direction)
      const vArrowY = p2.y
      const vDirection = p2.y > p1.y ? -1 : 1
      figures.push({
        type: 'line',
        attrs: {
          coordinates: [
            { x: midX - arrowSize, y: vArrowY + vDirection * arrowSize },
            { x: midX, y: vArrowY },
            { x: midX + arrowSize, y: vArrowY + vDirection * arrowSize }
          ]
        },
        styles: { style: 'solid' }
      })

      // Calculations
      const valueDiff = value2 - value1
      const pricePercent = (valueDiff / value1) * 100
      const absValueDiff = Math.abs(valueDiff).toFixed(precision.price)
      const bars = Math.abs(index2 - index1)
      
      let durationStr = ''
      if (t1 > 0 && t2 > 0) {
        const diffMs = Math.abs(t2 - t1)
        const diffMinutes = Math.floor(diffMs / (60 * 1000))
        const h = Math.floor(diffMinutes / 60)
        const m = diffMinutes % 60
        const d = Math.floor(h / 24)
        if (d > 0) {
          durationStr = `${d}d ${h % 24}h ${m}m`
        } else if (h > 0) {
          durationStr = `${h}h ${m}m`
        } else {
          durationStr = `${m}m`
        }
      }

      const text = `${valueDiff > 0 ? '' : '-'}${absValueDiff} (${pricePercent.toFixed(2)}%) ${Math.round(Math.abs(valueDiff) * Math.pow(10, precision.price))}\n${bars} bars, ${durationStr}`

      figures.push({
        type: 'text',
        attrs: {
          x: p2.x,
          y: p2.y + (p2.y > p1.y ? 20 : -20),
          text,
          align: 'center',
          baseline: p2.y > p1.y ? 'top' : 'bottom'
        }
      })
    }
    return figures
  }
}

export default ruler
