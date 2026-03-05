/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { OverlayTemplate, LineAttrs, TextAttrs } from 'klinecharts'

const fibonacciSegment: OverlayTemplate = {
  name: 'fibonacciSegment',
  totalStep: 3,
  needDefaultPointFigure: true,
  needDefaultXAxisFigure: true,
  needDefaultYAxisFigure: true,
  createPointFigures: ({ coordinates, overlay, precision, bounding }) => {
    const figures: any[] = []

    const defaultExtendData = {
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
    const extendData = overlay.extendData || defaultExtendData
    const levels = extendData.levels || defaultExtendData.levels

    if (coordinates.length > 1) {
      const yDif = coordinates[0].y - coordinates[1].y
      const points = overlay.points
      // @ts-expect-error
      const valueDif = points[0].value - points[1].value

      levels.forEach((level: any) => {
        if (!level.visible) return;

        const percent = level.value
        const y = coordinates[1].y + yDif * percent
        // @ts-expect-error
        const price = (points[1].value + valueDif * percent).toFixed(precision.price)

        let startX = coordinates[0].x
        let endX = coordinates[1].x

        if (extendData.extendLeft) {
          if (startX < endX) startX = 0; else endX = 0;
        }
        if (extendData.extendRight) {
          const width = bounding.width
          if (startX > endX) startX = width; else endX = width;
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
