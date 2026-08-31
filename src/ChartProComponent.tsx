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
  init, dispose, utils, Nullable, Chart, OverlayMode, Styles,
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

import { getLastFibSettings } from './widget/overlay-setting-modal'

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
          onConfirm={(extendData) => {
            const params = overlaySettingModalParams()
            if (params.overlay) {
              widget?.overrideOverlay({ id: params.overlay.id, extendData })
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
              widget?.createOverlay({
                ...overlay,
                ...(overlay.name === 'fibonacciSegment' ? { extendData: { ...getLastFibSettings(), isSelected: true } } : {}),
                onDrawEnd: (event: any) => {
                  if (event?.overlay?.name === 'fibonacciSegment') {
                    const extendData = { ...(event.overlay.extendData || {}), isSelected: false }
                    widget?.overrideOverlay({ id: event.overlay.id, extendData })
                  }
                  return true
                },
                onSelected: (event: any) => {
                  setSelectedOverlayId(event.overlay.id)
                  if (event?.overlay?.name === 'fibonacciSegment') {
                    const extendData = { ...(event.overlay.extendData || {}), isSelected: true }
                    widget?.overrideOverlay({ id: event.overlay.id, extendData })
                  }
                  return true
                },
                onDeselected: (event: any) => {
                  if (overlay.name === 'ruler') {
                    widget?.removeOverlay({ id: event.overlay.id })
                    return true
                  }
                  if (event?.overlay?.name === 'fibonacciSegment') {
                    const extendData = { ...(event.overlay.extendData || {}), isSelected: false }
                    widget?.overrideOverlay({ id: event.overlay.id, extendData })
                  }
                  setTimeout(() => {
                    if (selectedOverlayId() === event.overlay.id) {
                      setSelectedOverlayId('')
                    }
                  }, 100)
                  return true
                },
                onRightClick: (event: any) => {
                  if (overlay.name === 'fibonacciSegment') {
                    setOverlaySettingModalParams({ visible: true, overlay: event.overlay })
                    return true
                  }
                  return false
                }
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
