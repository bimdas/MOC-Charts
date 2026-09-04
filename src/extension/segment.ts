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

import { Coordinate, OverlayTemplate } from 'klinecharts'

export interface TrendLineExtendData {
  color?: string
  size?: number
  style?: 'solid' | 'dashed' | 'dotted'
  extendLeft?: boolean
  extendRight?: boolean
}

export const defaultTrendLineExtendData: TrendLineExtendData = {
  color: '#2962FF',
  size: 2,
  style: 'solid',
  extendLeft: false,
  extendRight: false
}

export const LAST_TREND_LINE_SETTINGS_KEY = 'klinecharts_trend_line_last_settings'

export function getLastTrendLineSettings(): TrendLineExtendData {
  try {
    const saved = localStorage.getItem(LAST_TREND_LINE_SETTINGS_KEY)
    if (saved) return JSON.parse(saved)
  } catch (e) { }
  return { ...defaultTrendLineExtendData }
}

export function saveLastTrendLineSettings(data: TrendLineExtendData): void {
  try {
    localStorage.setItem(LAST_TREND_LINE_SETTINGS_KEY, JSON.stringify(data))
  } catch (e) { }
}

/**
 * Extend a ray from anchor `from` through `through` until it hits the bounding box edges.
 */
function getRayIntersection(from: Coordinate, through: Coordinate, width: number, height: number): Coordinate {
  const dx = through.x - from.x
  const dy = through.y - from.y

  if (Math.abs(dx) < 1e-6) {
    return {
      x: through.x,
      y: dy > 0 ? height : 0
    }
  }

  if (Math.abs(dy) < 1e-6) {
    return {
      x: dx > 0 ? width : 0,
      y: through.y
    }
  }

  const slope = dy / dx
  const intercept = from.y - slope * from.x

  // Targets based on direction
  const targetX = dx > 0 ? width : 0
  const yAtTargetX = slope * targetX + intercept

  if (yAtTargetX >= 0 && yAtTargetX <= height) {
    return { x: targetX, y: yAtTargetX }
  }

  const targetY = dy > 0 ? height : 0
  const xAtTargetY = (targetY - intercept) / slope
  return { x: xAtTargetY, y: targetY }
}

const segment: OverlayTemplate<any> = {
  name: 'segment',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  styles: {
    point: {
      color: '#ffffff',
      borderColor: '#2962FF',
      borderSize: 2,
      radius: 5,
      activeColor: '#ffffff',
      activeBorderColor: '#2962FF',
      activeBorderSize: 3,
      activeRadius: 6
    }
  },
  createPointFigures: ({ coordinates, overlay, bounding }) => {
    if (coordinates.length === 2 && coordinates[0] && coordinates[1]) {
      let defaultSettings = defaultTrendLineExtendData
      try {
        const saved = localStorage.getItem(LAST_TREND_LINE_SETTINGS_KEY)
        if (saved) defaultSettings = JSON.parse(saved)
      } catch (e) { }

      const extendData: TrendLineExtendData = overlay.extendData || defaultSettings
      const color = overlay.styles?.line?.color || extendData.color || defaultSettings.color || '#2962FF'
      const size = overlay.styles?.line?.size ?? extendData.size ?? defaultSettings.size ?? 2
      const lineStyle = overlay.styles?.line?.style || extendData.style || defaultSettings.style || 'solid'

      const actualStyle: 'solid' | 'dashed' = lineStyle === 'solid' ? 'solid' : 'dashed'
      const dashedValue = lineStyle === 'dotted' ? [2, 2] : [6, 4]

      let startCoord: Coordinate = { x: coordinates[0].x, y: coordinates[0].y }
      let endCoord: Coordinate = { x: coordinates[1].x, y: coordinates[1].y }

      const width = bounding?.width ?? 2000
      const height = bounding?.height ?? 2000

      if (extendData.extendLeft) {
        // Extend from coordinates[1] through coordinates[0]
        startCoord = getRayIntersection(coordinates[1], coordinates[0], width, height)
      }

      if (extendData.extendRight) {
        // Extend from coordinates[0] through coordinates[1]
        endCoord = getRayIntersection(coordinates[0], coordinates[1], width, height)
      }

      return [
        {
          type: 'line',
          attrs: { coordinates: [startCoord, endCoord] },
          styles: {
            style: actualStyle,
            size,
            color,
            dashedValue: actualStyle === 'dashed' ? dashedValue : undefined
          }
        }
      ]
    }
    return []
  }
}

export default segment
