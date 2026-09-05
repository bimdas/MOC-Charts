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

import { createSignal, createEffect, onMount, Show, onCleanup, startTransition, Component } from 'solid-js'

import {
  init, dispose, utils, Nullable, Chart, OverlayCreate, OverlayMode, Styles,
  PaneOptions, Indicator, DataLoader, PeriodType,
  SymbolInfo as CoreSymbolInfo, Period as CorePeriod
} from 'klinecharts'

import lodashSet from 'lodash/set'
import lodashClone from 'lodash/cloneDeep'

import { SelectDataSourceItem, Loading } from './component'

import {
  PeriodBar, DrawingBar, IndicatorModal, TimezoneModal, SettingModal,
  ScreenshotModal, IndicatorSettingModal, SymbolSearchModal, OverlaySettingModal
} from './widget'

import { getLastFibSettings, getLastTrendLineSettings } from './widget/overlay-setting-modal'

import { translateTimezone } from './widget/timezone-modal/data'

import { SymbolInfo, Period, ChartProOptions, ChartPro } from './types'

export interface ChartProComponentProps extends Required<Omit<ChartProOptions, 'container' | 'onDataReady' | 'onPeriodChange' | 'onIndicatorChange'>> {
  ref: (chart: ChartPro) => void
  onDataReady?: () => void
  onPeriodChange?: (period: Period) => void
  onIndicatorChange?: (mainIndicators: string[], subIndicators: string[]) => void
}

function toCoreSymbol(symbol: SymbolInfo): CoreSymbolInfo {
  return {
    ...symbol,
    ticker: symbol.ticker,
    pricePrecision: symbol.pricePrecision ?? 2,
    volumePrecision: symbol.volumePrecision ?? 0
  }
}

function toCorePeriod(period: Period): CorePeriod {
  return {
    span: period.multiplier,
    type: period.timespan as PeriodType
  }
}

function fromCorePeriod(period: CorePeriod, periods: Period[]): Period {
  return periods.find(item => item.multiplier === period.span && item.timespan === period.type) ?? {
    multiplier: period.span,
    timespan: period.type,
    text: `${period.span}${period.type}`
  }
}

function createIndicator(widget: Nullable<Chart>, indicatorName: string, isStack?: boolean, paneOptions?: Partial<PaneOptions>): Nullable<string> {
  return widget?.createIndicator({
    name: indicatorName,
    paneId: paneOptions?.id
  }, isStack) ?? null
}

const ChartProComponent: Component<ChartProComponentProps> = props => {
  let widgetRef: HTMLDivElement | undefined = undefined
  let widget: Nullable<Chart> = null
  let handleMouseDown: (e: MouseEvent) => void
  let isShortcutStarting = false

  let priceUnitDom: HTMLElement

  const [theme, setTheme] = createSignal(props.theme)
  const [styles, setStyles] = createSignal(props.styles)
  const [locale, setLocale] = createSignal(props.locale)

  const [symbol, setSymbol] = createSignal(props.symbol)
  const [period, setPeriod] = createSignal(props.period)
  const [indicatorModalVisible, setIndicatorModalVisible] = createSignal(false)
  const [mainIndicators, setMainIndicators] = createSignal([...(props.mainIndicators!)])
  const [subIndicators, setSubIndicators] = createSignal({})

  const [timezoneModalVisible, setTimezoneModalVisible] = createSignal(false)
  const [timezone, setTimezone] = createSignal<SelectDataSourceItem>({ key: props.timezone, text: translateTimezone(props.timezone, props.locale) })

  const [settingModalVisible, setSettingModalVisible] = createSignal(false)
  const [widgetDefaultStyles, setWidgetDefaultStyles] = createSignal<Styles>()

  const [screenshotUrl, setScreenshotUrl] = createSignal('')

  const [drawingBarVisible, setDrawingBarVisible] = createSignal(props.drawingBarVisible ?? true)

  const [selectedOverlayId, setSelectedOverlayId] = createSignal<string>('')

  const [symbolSearchModalVisible, setSymbolSearchModalVisible] = createSignal(false)

  const [loadingVisible, setLoadingVisible] = createSignal(false)

  const [indicatorSettingModalParams, setIndicatorSettingModalParams] = createSignal({
    visible: false, indicatorName: '', paneId: '', calcParams: [] as Array<any>
  })

  const [overlaySettingModalParams, setOverlaySettingModalParams] = createSignal({
    visible: false, overlay: null as any
  })

  const isSettingSupportedOverlay = (name?: string) => name === 'fibonacciSegment' || name === 'segment'

  const handleOverlayDoubleClick = (event: any) => {
    if (isSettingSupportedOverlay(event.overlay.name)) {
      setOverlaySettingModalParams({ visible: true, overlay: event.overlay })
      return true
    }
    return false
  }

  const restoreOverlayEventHandlers = (overlay: string | OverlayCreate): string | OverlayCreate => {
    const name = typeof overlay === 'string' ? overlay : overlay.name
    if (!isSettingSupportedOverlay(name) || (typeof overlay !== 'string' && typeof overlay.onDoubleClick === 'function')) {
      return overlay
    }
    return {
      ...(typeof overlay === 'string' ? { name: overlay } : overlay),
      onDoubleClick: handleOverlayDoubleClick
    }
  }

  props.ref({
    getWidget: () => widget,
    setTheme,
    getTheme: () => theme(),
    setStyles,
    getStyles: () => widget!.getStyles(),
    setLocale,
    getLocale: () => locale(),
    setTimezone: (timezone: string) => { setTimezone({ key: timezone, text: translateTimezone(props.timezone, locale()) }) },
    getTimezone: () => timezone().key,
    setSymbol,
    getSymbol: () => symbol(),
    setPeriod,
    getPeriod: () => period()
  })

  const documentResize = () => {
    widget?.resize()
  }

  const adjustFromTo = (period: Period, toTimestamp: number, count: number) => {
    let to = toTimestamp
    let from = to
    switch (period.timespan) {
      case 'minute': {
        to = to - (to % (60 * 1000))
        from = to - count * period.multiplier * 60 * 1000
        break
      }
      case 'hour': {
        to = to - (to % (60 * 60 * 1000))
        from = to - count * period.multiplier * 60 * 60 * 1000
        break
      }
      case 'day': {
        to = to - (to % (60 * 60 * 1000))
        from = to - count * period.multiplier * 24 * 60 * 60 * 1000
        break
      }
      case 'week': {
        const date = new Date(to)
        const week = date.getDay()
        const dif = week === 0 ? 6 : week - 1
        to = to - dif * 60 * 60 * 24 * 1000
        const newDate = new Date(to)
        to = new Date(`${newDate.getFullYear()}-${newDate.getMonth() + 1}-${newDate.getDate()}`).getTime()
        from = to - count * period.multiplier * 7 * 24 * 60 * 60 * 1000
        break
      }
      case 'month': {
        const date = new Date(to)
        const year = date.getFullYear()
        const month = date.getMonth() + 1
        to = new Date(`${year}-${month}-01`).getTime()
        from = to - count * period.multiplier * 30 * 24 * 60 * 60 * 1000
        const fromDate = new Date(from)
        from = new Date(`${fromDate.getFullYear()}-${fromDate.getMonth() + 1}-01`).getTime()
        break
      }
      case 'year': {
        const date = new Date(to)
        const year = date.getFullYear()
        to = new Date(`${year}-01-01`).getTime()
        from = to - count * period.multiplier * 365 * 24 * 60 * 60 * 1000
        const fromDate = new Date(from)
        from = new Date(`${fromDate.getFullYear()}-01-01`).getTime()
        break
      }
    }
    return [from, to]
  }

  onMount(() => {
    handleMouseDown = (e: MouseEvent) => {
      if (e.shiftKey && e.button === 0 && widget && !isShortcutStarting) {
        isShortcutStarting = true
        const id = widget.createOverlay({
          name: 'ruler',
          onDrawEnd: () => {
            isShortcutStarting = false
          },
          onRemoved: () => {
            isShortcutStarting = false
          },
          onSelected: (event: any) => {
            setSelectedOverlayId(event.overlay.id)
            return true
          },
          onDeselected: (event: any) => {
            widget?.removeOverlay({ id: event.overlay.id })
            return true
          }
        })
        if (!id) {
          isShortcutStarting = false
        }
      }
    }

    window.addEventListener('resize', documentResize)
    const ref = widgetRef as unknown as HTMLDivElement
    ref?.addEventListener('mousedown', handleMouseDown, true)
    widget = init(widgetRef!, {
      formatter: {
        formatDate: ({ dateTimeFormat, timestamp, type }) => {
          const p = period()
          switch (p.timespan) {
            case 'minute': {
              if (type === 'xAxis') {
                return utils.formatDate(dateTimeFormat, timestamp, 'HH:mm')
              }
              return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD HH:mm')
            }
            case 'hour': {
              if (type === 'xAxis') {
                return utils.formatDate(dateTimeFormat, timestamp, 'MM-DD HH:mm')
              }
              return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD HH:mm')
            }
            case 'day':
            case 'week': return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD')
            case 'month': {
              if (type === 'xAxis') {
                return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM')
              }
              return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD')
            }
            case 'year': {
              if (type === 'xAxis') {
                return utils.formatDate(dateTimeFormat, timestamp, 'YYYY')
              }
              return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD')
            }
          }
          return utils.formatDate(dateTimeFormat, timestamp, 'YYYY-MM-DD HH:mm')
        }
      }
    })

    if (widget) {
      // Fix touchscreen tablet overlay point dragging crosshair guides
      const chartEvent = (widget as any)._chartEvent
      if (chartEvent && typeof chartEvent.touchMoveEvent === 'function' && typeof chartEvent.touchStartEvent === 'function') {
        const origTouchStart = chartEvent.touchStartEvent.bind(chartEvent)
        const origTouchMove = chartEvent.touchMoveEvent.bind(chartEvent)
        const origTouchEnd = typeof chartEvent.touchEndEvent === 'function' ? chartEvent.touchEndEvent.bind(chartEvent) : null
        const origLongTap = typeof chartEvent.longTapEvent === 'function' ? chartEvent.longTapEvent.bind(chartEvent) : null

        const findNearOverlayPoint = (eventCoord: { x: number, y: number }, tolerance = 32) => {
          const chartStore = (widget as any)?.getChartStore()
          const drawPane = (widget as any).getDrawPaneById('candle_pane')
          if (!chartStore || !drawPane) return null

          const yAxis = drawPane.getYAxisComponentById()
          if (!yAxis) return null

          const clickInfo = chartStore.getClickOverlayInfo()
          const selectedOverlay = clickInfo?.overlay
          const allOverlays = chartStore.getOverlaysByPaneId('candle_pane') || []
          const candidateOverlays = selectedOverlay
            ? [selectedOverlay, ...allOverlays.filter((o: any) => o.id !== selectedOverlay.id)]
            : allOverlays

          for (const overlay of candidateOverlays) {
            if (overlay.lock || !overlay.visible || !overlay.points) continue
            const points = overlay.points
            for (let i = 0; i < points.length; i++) {
              const p = points[i]
              if (!p) continue
              let dataIndex: number | null = null
              if (typeof p.timestamp === 'number') {
                dataIndex = chartStore.timestampToDataIndex(p.timestamp)
              } else if (typeof p.dataIndex === 'number') {
                dataIndex = p.dataIndex
              }
              if (dataIndex === null || typeof p.value !== 'number') continue
              const ptX = chartStore.dataIndexToCoordinate(dataIndex)
              const ptY = yAxis.convertToPixel(p.value)
              if (typeof ptX === 'number' && typeof ptY === 'number') {
                const dist = Math.hypot(eventCoord.x - ptX, eventCoord.y - ptY)
                if (dist <= tolerance) {
                  return { overlay, pointIndex: i, ptX, ptY, paneId: drawPane.getId() }
                }
              }
            }
          }
          return null
        }

        const grabOverlayPoint = (match: { overlay: any, pointIndex: number, ptX: number, ptY: number, paneId: string }, eventCoord: { x: number, y: number }) => {
          const chartStore = (widget as any)?.getChartStore()
          if (!chartStore) return

          // Cancel any chart scroll/fling that may have started
          chartEvent._startScrollCoordinate = null
          if (chartEvent._flingScrollAnimation) {
            chartEvent._flingScrollAnimation.cancel()
            chartEvent._flingScrollAnimation = null
          }

          chartStore.setClickOverlayInfo({
            paneId: match.paneId,
            overlay: match.overlay,
            figureType: 'point',
            figureIndex: match.pointIndex,
            figure: { key: `overlay_figure_point_${match.pointIndex}`, type: 'circle' }
          })

          const pt = (widget as any).convertFromPixel({ x: eventCoord.x, y: eventCoord.y }, { paneId: match.paneId })
          if (typeof match.overlay.startPressedMove === 'function') {
            match.overlay.startPressedMove(pt || {})
          }

          chartStore.setPressedOverlayInfo({
            paneId: match.paneId,
            overlay: match.overlay,
            figureType: 'point',
            figureIndex: match.pointIndex,
            figure: { key: `overlay_figure_point_${match.pointIndex}`, type: 'circle' }
          })

          chartEvent._touchCoordinate = { x: match.ptX, y: match.ptY }
          chartStore.setCrosshair({ x: match.ptX, y: match.ptY, paneId: match.paneId }, { forceInvalidate: true })
          ;(widget as any).updatePane(1)
        }

        chartEvent.touchStartEvent = function (e: any) {
          const chartStore = (widget as any)?.getChartStore()
          const drawPane = (widget as any).getDrawPaneById('candle_pane')
          const mainWidget = drawPane?.getMainWidget()

          const res = origTouchStart(e)

          try {
            const pressed = chartStore?.getPressedOverlayInfo()
            if (pressed && pressed.overlay) {
              if (drawPane && mainWidget && chartEvent._makeWidgetEvent) {
                const event = chartEvent._makeWidgetEvent(e, mainWidget)
                chartEvent._touchCoordinate = { x: event.x, y: event.y }
                chartStore.setCrosshair({ x: event.x, y: event.y, paneId: drawPane.getId() }, { forceInvalidate: true })
              }
            } else if (mainWidget && chartEvent._makeWidgetEvent) {
              const event = chartEvent._makeWidgetEvent(e, mainWidget)
              const match = findNearOverlayPoint(event, 32)
              if (match) {
                grabOverlayPoint(match, event)
                return true
              }
            }
          } catch (err) {
            console.warn('Error in touchStart overlay handling:', err)
          }
          return res
        }

        if (origLongTap) {
          chartEvent.longTapEvent = function (e: any) {
            try {
              const chartStore = (widget as any)?.getChartStore()
              const drawPane = (widget as any).getDrawPaneById('candle_pane')
              const mainWidget = drawPane?.getMainWidget()
              const pressed = chartStore?.getPressedOverlayInfo()
              if ((!pressed || !pressed.overlay) && mainWidget && chartEvent._makeWidgetEvent) {
                const event = chartEvent._makeWidgetEvent(e, mainWidget)
                const match = findNearOverlayPoint(event, 35)
                if (match) {
                  grabOverlayPoint(match, event)
                  return true
                }
              }
            } catch (err) {
              console.warn('Error in longTap overlay handling:', err)
            }
            return origLongTap(e)
          }
        }

        chartEvent.touchMoveEvent = function (e: any) {
          const chartStore = (widget as any)?.getChartStore()
          let pressed = chartStore?.getPressedOverlayInfo()

          const drawPane = (widget as any).getDrawPaneById((pressed && pressed.overlay && pressed.paneId) || 'candle_pane')
          const mainWidget = drawPane?.getMainWidget()

          if ((!pressed || !pressed.overlay) && mainWidget && chartEvent._makeWidgetEvent) {
            const event = chartEvent._makeWidgetEvent(e, mainWidget)
            const match = findNearOverlayPoint(event, 28)
            if (match) {
              grabOverlayPoint(match, event)
              pressed = chartStore?.getPressedOverlayInfo()
            }
          }

          if (pressed && pressed.overlay) {
            if (drawPane && mainWidget && chartEvent._makeWidgetEvent) {
              if (e.cancelable && typeof e.preventDefault === 'function') {
                e.preventDefault()
              }
              const event = chartEvent._makeWidgetEvent(e, mainWidget)
              const bounding = mainWidget.getBounding()
              // Clamp coordinates within main widget bounds so dragging to edges/top never loses touch
              const clampedX = Math.max(0, Math.min(bounding.width, event.x))
              const clampedY = Math.max(0, Math.min(bounding.height, event.y))
              const clampedEvent = { ...event, x: clampedX, y: clampedY }

              // Update overlay point position
              mainWidget.dispatchEvent('pressedMouseMoveEvent', clampedEvent)

              // Keep crosshair active & visible at clamped coordinate
              chartEvent._touchCoordinate = { x: clampedX, y: clampedY }
              chartStore.setCrosshair({ x: clampedX, y: clampedY, paneId: drawPane.getId() }, { forceInvalidate: true })
              return true
            }
          }

          return origTouchMove(e)
        }

        if (origTouchEnd) {
          chartEvent.touchEndEvent = function (e: any) {
            const chartStore = (widget as any)?.getChartStore()
            const pressed = chartStore?.getPressedOverlayInfo()

            if (pressed && pressed.overlay) {
              const drawPane = (widget as any).getDrawPaneById(pressed.paneId || 'candle_pane')
              const mainWidget = drawPane?.getMainWidget()
              if (drawPane && mainWidget && chartEvent._makeWidgetEvent) {
                const event = chartEvent._makeWidgetEvent(e, mainWidget)
                mainWidget.dispatchEvent('mouseUpEvent', event)
              }
              chartStore.setPressedOverlayInfo({
                paneId: pressed.paneId || 'candle_pane',
                overlay: null,
                figureType: 'none',
                figureIndex: -1,
                figure: null
              })
              ;(widget as any).updatePane(1)
            }
            return origTouchEnd(e)
          }
        }
      }


      const createOverlay = widget.createOverlay.bind(widget)
      widget.createOverlay = value => {
        const valueWithHandlers = Array.isArray(value)
          ? value.map(item => restoreOverlayEventHandlers(item))
          : restoreOverlayEventHandlers(value)
        return createOverlay(valueWithHandlers)
      }

      const watermarkContainer = widget.getDom('candle_pane', 'main')
      if (watermarkContainer) {
        let watermark = document.createElement('div')
        watermark.className = 'klinecharts-pro-watermark'
        if (utils.isString(props.watermark)) {
          const str = (props.watermark as string).replace(/(^\s*)|(\s*$)/g, '')
          watermark.innerHTML = str
        } else {
          watermark.appendChild(props.watermark as Node)
        }
        watermarkContainer.appendChild(watermark)
      }

      const priceUnitContainer = widget.getDom('candle_pane', 'yAxis')
      priceUnitDom = document.createElement('span')
      priceUnitDom.className = 'klinecharts-pro-price-unit'
      priceUnitContainer?.appendChild(priceUnitDom)
    }

    mainIndicators().forEach(indicator => {
      createIndicator(widget, indicator, true, { id: 'candle_pane' })
    })
    const subIndicatorMap = {}
    props.subIndicators!.forEach(indicator => {
      const paneId = createIndicator(widget, indicator, true)
      if (paneId) {
        // @ts-expect-error
        subIndicatorMap[indicator] = paneId
      }
    })
    setSubIndicators(subIndicatorMap)
    const dataLoader: DataLoader = {
      getBars: async ({ type, timestamp, symbol: coreSymbol, period: corePeriod, callback }) => {
        setLoadingVisible(true)
        try {
          const currentSymbol = coreSymbol as SymbolInfo
          const currentPeriod = fromCorePeriod(corePeriod, props.periods)
          const anchor = timestamp ?? Date.now()

          if (type === 'backward') {
            const [, to] = adjustFromTo(currentPeriod, Date.now(), 1)
            const from = (timestamp ?? to) + 1
            const kLineDataList = from <= to
              ? await props.datafeed.getHistoryKLineData(currentSymbol, currentPeriod, from, to)
              : []
            callback(kLineDataList, { forward: true, backward: false })
            props.onDataReady?.()
          } else {
            const [to] = adjustFromTo(currentPeriod, anchor, type === 'forward' ? 1 : 0)
            const [from] = adjustFromTo(currentPeriod, to, 500)
            const kLineDataList = await props.datafeed.getHistoryKLineData(currentSymbol, currentPeriod, from, to)
            callback(kLineDataList, { forward: kLineDataList.length > 0, backward: false })
            props.onDataReady?.()
          }
        } finally {
          setLoadingVisible(false)
        }
      },
      subscribeBar: ({ symbol: coreSymbol, period: corePeriod, callback }) => {
        props.datafeed.subscribe(coreSymbol as SymbolInfo, fromCorePeriod(corePeriod, props.periods), callback)
      },
      unsubscribeBar: ({ symbol: coreSymbol, period: corePeriod }) => {
        props.datafeed.unsubscribe(coreSymbol as SymbolInfo, fromCorePeriod(corePeriod, props.periods))
      }
    }
    widget?.setDataLoader(dataLoader)
    widget?.setSymbol(toCoreSymbol(symbol()))
    widget?.setPeriod(toCorePeriod(period()))

    widget?.subscribeAction('onIndicatorTooltipFeatureClick', (eventData) => {
      const data = eventData as { paneId: string, feature: { id: string }, indicator?: Indicator }
      if (data.indicator) {
        switch (data.feature.id) {
          case 'visible': {
            widget?.overrideIndicator({ id: data.indicator.id, name: data.indicator.name, visible: true })
            break
          }
          case 'invisible': {
            widget?.overrideIndicator({ id: data.indicator.id, name: data.indicator.name, visible: false })
            break
          }
          case 'setting': {
            setIndicatorSettingModalParams({
              visible: true, indicatorName: data.indicator.name, paneId: data.paneId, calcParams: data.indicator.calcParams as any[]
            })
            break
          }
          case 'close': {
            if (data.paneId === 'candle_pane') {
              const newMainIndicators = [...mainIndicators()]
              widget?.removeIndicator({ id: data.indicator.id })
              newMainIndicators.splice(newMainIndicators.indexOf(data.indicator.name), 1)
              setMainIndicators(newMainIndicators)
            } else {
              const newIndicators = { ...subIndicators() }
              widget?.removeIndicator({ id: data.indicator.id })
              // @ts-expect-error
              delete newIndicators[data.indicator.name]
              setSubIndicators(newIndicators)
            }
          }
        }
      }
    })
  })

  onCleanup(() => {
    const ref = widgetRef as unknown as HTMLDivElement
    ref?.removeEventListener('mousedown', handleMouseDown, true)
    window.removeEventListener('resize', documentResize)
    dispose(widgetRef!)
  })

  createEffect(() => {
    const s = symbol()
    if (priceUnitDom && s?.priceCurrency) {
      priceUnitDom.innerHTML = s?.priceCurrency.toLocaleUpperCase()
      priceUnitDom.style.display = 'flex'
    } else if (priceUnitDom) {
      priceUnitDom.style.display = 'none'
    }
    const coreSymbol = toCoreSymbol(s)
    const currentSymbol = widget?.getSymbol()
    if (!currentSymbol ||
      currentSymbol.ticker !== coreSymbol.ticker ||
      currentSymbol.pricePrecision !== coreSymbol.pricePrecision ||
      currentSymbol.volumePrecision !== coreSymbol.volumePrecision) {
      widget?.setSymbol(coreSymbol)
    }
  })

  createEffect(() => {
    const corePeriod = toCorePeriod(period())
    const currentPeriod = widget?.getPeriod()
    if (!currentPeriod || currentPeriod.span !== corePeriod.span || currentPeriod.type !== corePeriod.type) {
      widget?.setPeriod(corePeriod)
    }
  })

  createEffect(() => {
    const t = theme()
    widget?.setStyles(t)
    const color = t === 'dark' ? '#929AA5' : '#76808F'
    widget?.setStyles({
      indicator: {
        tooltip: {
          features: [
            {
              id: 'visible',
              position: 'middle',
              marginLeft: 8,
              marginTop: 7,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: { family: 'icomoon', code: '\ue903' },
              borderRadius: 0,
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            },
            {
              id: 'invisible',
              position: 'middle',
              marginLeft: 8,
              marginTop: 7,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: { family: 'icomoon', code: '\ue901' },
              borderRadius: 0,
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            },
            {
              id: 'setting',
              position: 'middle',
              marginLeft: 6,
              marginTop: 7,
              marginBottom: 0,
              marginRight: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: { family: 'icomoon', code: '\ue902' },
              borderRadius: 0,
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            },
            {
              id: 'close',
              position: 'middle',
              marginLeft: 6,
              marginTop: 7,
              marginRight: 0,
              marginBottom: 0,
              paddingLeft: 0,
              paddingTop: 0,
              paddingRight: 0,
              paddingBottom: 0,
              type: 'icon_font',
              content: { family: 'icomoon', code: '\ue900' },
              borderRadius: 0,
              size: 14,
              color: color,
              activeColor: color,
              backgroundColor: 'transparent',
              activeBackgroundColor: 'rgba(22, 119, 255, 0.15)'
            }
          ]
        }
      }
    })
  })

  createEffect(() => {
    widget?.setLocale(locale())
  })

  createEffect(() => {
    widget?.setTimezone(timezone().key)
  })

  createEffect(() => {
    if (styles()) {
      widget?.setStyles(styles())
      setWidgetDefaultStyles(lodashClone(widget!.getStyles()))
    }
  })

  createEffect(() => {
    props.onIndicatorChange?.(mainIndicators(), Object.keys(subIndicators()))
  })

  return (
    <>
      <i class="icon-close klinecharts-pro-load-icon" />
      <Show when={symbolSearchModalVisible()}>
        <SymbolSearchModal
          locale={props.locale}
          datafeed={props.datafeed}
          onSymbolSelected={symbol => { setSymbol(symbol) }}
          onClose={() => { setSymbolSearchModalVisible(false) }} />
      </Show>
      <Show when={indicatorModalVisible()}>
        <IndicatorModal
          locale={props.locale}
          mainIndicators={mainIndicators()}
          subIndicators={subIndicators()}
          onClose={() => { setIndicatorModalVisible(false) }}
          onMainIndicatorChange={data => {
            const newMainIndicators = [...mainIndicators()]
            if (data.added) {
              createIndicator(widget, data.name, true, { id: 'candle_pane' })
              newMainIndicators.push(data.name)
            } else {
              widget?.removeIndicator({ paneId: 'candle_pane', name: data.name })
              newMainIndicators.splice(newMainIndicators.indexOf(data.name), 1)
            }
            setMainIndicators(newMainIndicators)
          }}
          onSubIndicatorChange={data => {
            const newSubIndicators = { ...subIndicators() }
            if (data.added) {
              const paneId = createIndicator(widget, data.name)
              if (paneId) {
                // @ts-expect-error
                newSubIndicators[data.name] = paneId
              }
            } else {
              if (data.paneId) {
                widget?.removeIndicator({ paneId: data.paneId, name: data.name })
                // @ts-expect-error
                delete newSubIndicators[data.name]
              }
            }
            setSubIndicators(newSubIndicators)
          }} />
      </Show>
      <Show when={timezoneModalVisible()}>
        <TimezoneModal
          locale={props.locale}
          timezone={timezone()}
          onClose={() => { setTimezoneModalVisible(false) }}
          onConfirm={setTimezone}
        />
      </Show>
      <Show when={settingModalVisible()}>
        <SettingModal
          locale={props.locale}
          currentStyles={utils.clone(widget!.getStyles())}
          currentYAxis={(() => {
            const yAxis = widget!.getYAxes({ paneId: 'candle_pane' })[0] as any
            return { name: yAxis?.name ?? 'normal', reverse: yAxis?.reverse ?? false }
          })()}
          onClose={() => { setSettingModalVisible(false) }}
          onChange={style => {
            widget?.setStyles(style)
          }}
          onYAxisChange={(key, value) => {
            widget?.overrideYAxis({ paneId: 'candle_pane', [key]: value } as any)
          }}
          onRestoreDefault={(options: SelectDataSourceItem[]) => {
            const style = {}
            options.filter(option => !option.key.startsWith('axis.')).forEach(option => {
              const key = option.key
              lodashSet(style, key, utils.formatValue(widgetDefaultStyles(), key))
            })
            widget?.setStyles(style)
            widget?.overrideYAxis({ paneId: 'candle_pane', name: 'normal', reverse: false })
          }}
        />
      </Show>
      <Show when={screenshotUrl().length > 0}>
        <ScreenshotModal
          locale={props.locale}
          url={screenshotUrl()}
          onClose={() => { setScreenshotUrl('') }}
        />
      </Show>
      <Show when={indicatorSettingModalParams().visible}>
        <IndicatorSettingModal
          locale={props.locale}
          params={indicatorSettingModalParams()}
          onClose={() => { setIndicatorSettingModalParams({ visible: false, indicatorName: '', paneId: '', calcParams: [] }) }}
          onConfirm={(params) => {
            const modalParams = indicatorSettingModalParams()
            widget?.overrideIndicator({ name: modalParams.indicatorName, paneId: modalParams.paneId, calcParams: params })
          }}
        />
      </Show>
      <PeriodBar
        locale={props.locale}
        symbol={symbol()}
        spread={drawingBarVisible()}
        period={period()}
        periods={props.periods}
        onMenuClick={async () => {
          try {
            await startTransition(() => setDrawingBarVisible(!drawingBarVisible()))
            widget?.resize()
          } catch (e) { }
        }}
        onSymbolClick={() => { setSymbolSearchModalVisible(!symbolSearchModalVisible()) }}
        onPeriodChange={(p) => {
          setPeriod(p)
          props.onPeriodChange?.(p)
        }}
        onIndicatorClick={() => { setIndicatorModalVisible((visible => !visible)) }}
        onTimezoneClick={() => { setTimezoneModalVisible((visible => !visible)) }}
        onSettingClick={() => { setSettingModalVisible((visible => !visible)) }}
        onScreenshotClick={() => {
          if (widget) {
            const url = widget.getConvertPictureUrl(true, 'jpeg', props.theme === 'dark' ? '#151517' : '#ffffff')
            setScreenshotUrl(url)
          }
        }}
      />
      <Show when={overlaySettingModalParams().visible}>
        <OverlaySettingModal
          locale={props.locale}
          overlay={overlaySettingModalParams().overlay!}
          onClose={() => { setOverlaySettingModalParams({ visible: false, overlay: null }) }}
          onLiveUpdate={(extendData, styles) => {
            const params = overlaySettingModalParams()
            if (params.overlay) {
              const overrideParams: any = { id: params.overlay.id, extendData }
              if (styles) {
                overrideParams.styles = styles
              }
              widget?.overrideOverlay(overrideParams)
            }
          }}
          onCancelRevert={(initialExtendData, initialStyles) => {
            const params = overlaySettingModalParams()
            if (params.overlay) {
              const overrideParams: any = { id: params.overlay.id, extendData: initialExtendData }
              if (initialStyles) {
                overrideParams.styles = initialStyles
              }
              widget?.overrideOverlay(overrideParams)
            }
          }}
          onConfirm={(extendData, styles) => {
            const params = overlaySettingModalParams()
            if (params.overlay) {
              const overrideParams: any = { id: params.overlay.id, extendData }
              if (styles) {
                overrideParams.styles = styles
              }
              widget?.overrideOverlay(overrideParams)
            }
          }}
        />
      </Show>
      <div
        class="klinecharts-pro-content">
        <Show when={loadingVisible()}>
          <Loading />
        </Show>
        <Show when={drawingBarVisible()}>
          <DrawingBar
            locale={props.locale}
            onDrawingItemClick={overlay => {
              const extendData = overlay.name === 'fibonacciSegment'
                ? getLastFibSettings()
                : (overlay.name === 'segment' ? getLastTrendLineSettings() : undefined)
              const styles = overlay.name === 'segment' && extendData
                ? {
                    line: {
                      color: extendData.color,
                      size: extendData.size,
                      style: extendData.style === 'dotted' ? 'dashed' : extendData.style,
                      dashedValue: extendData.style === 'dotted' ? [2, 2] : [6, 4]
                    },
                    point: {
                      borderColor: extendData.color,
                      activeBorderColor: extendData.color
                    }
                  }
                : undefined

              widget?.createOverlay({
                ...overlay,
                ...(extendData ? { extendData } : {}),
                ...(styles ? { styles } : {}),
                onSelected: (event: any) => {
                  setSelectedOverlayId(event.overlay.id)
                  return true
                },
                onDeselected: (event: any) => {
                  if (overlay.name === 'ruler') {
                    widget?.removeOverlay({ id: event.overlay.id })
                    return true
                  }
                  setTimeout(() => {
                    if (selectedOverlayId() === event.overlay.id) {
                      setSelectedOverlayId('')
                    }
                  }, 100)
                  return true
                },
                onDoubleClick: handleOverlayDoubleClick
              } as any)
            }}
            onModeChange={mode => { widget?.overrideOverlay({ mode: mode as OverlayMode }) }}
            onLockChange={lock => { widget?.overrideOverlay({ lock }) }}
            onVisibleChange={visible => { widget?.overrideOverlay({ visible }) }}
            onRemoveClick={(groupId) => {
              if (selectedOverlayId()) {
                widget?.removeOverlay({ id: selectedOverlayId() })
                setSelectedOverlayId('')
              } else {
                widget?.removeOverlay({ groupId })
              }
            }} />
        </Show>
        <div
          ref={widgetRef}
          class='klinecharts-pro-widget'
          data-drawing-bar-visible={drawingBarVisible()} />
      </div>
    </>
  )
}

export default ChartProComponent
