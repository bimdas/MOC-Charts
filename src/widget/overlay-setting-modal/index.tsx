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

import { Component, createSignal, For, onMount, onCleanup, Show } from 'solid-js'

import { utils, Overlay } from 'klinecharts'

import { Select } from '../../component'

import {
    defaultTrendLineExtendData,
    getLastTrendLineSettings,
    saveLastTrendLineSettings,
    TrendLineExtendData
} from '../../extension/segment'

export {
    defaultTrendLineExtendData,
    getLastTrendLineSettings,
    saveLastTrendLineSettings
}
export type { TrendLineExtendData }

export interface OverlaySettingModalProps {
    locale: string
    overlay: Overlay<any>
    onClose: () => void
    onConfirm: (extendData: any, styles?: any) => void
    onLiveUpdate?: (extendData: any, styles?: any) => void
    onCancelRevert?: (initialExtendData: any, initialStyles?: any) => void
}

export const defaultFibonacciExtendData = {
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

const LAST_FIB_SETTINGS_KEY = 'klinecharts_fib_last_settings'

export function getLastFibSettings(): any {
    try {
        const saved = localStorage.getItem(LAST_FIB_SETTINGS_KEY)
        if (saved) return JSON.parse(saved)
    } catch (e) { }
    return utils.clone(defaultFibonacciExtendData)
}

function saveLastFibSettings(data: any): void {
    try {
        localStorage.setItem(LAST_FIB_SETTINGS_KEY, JSON.stringify(data))
    } catch (e) { }
}

const PRESET_COLORS = [
    '#2962FF', // TradingView Blue
    '#089981', // Teal Green
    '#F23645', // Coral Red
    '#FF9800', // Amber Orange
    '#9C27B0', // Purple
    '#E0E3EB', // Light Silver/White
    '#FFD700', // Gold
    '#00BCD4'  // Cyan
]

const OverlaySettingModal: Component<OverlaySettingModalProps> = props => {
    let panelRef: HTMLDivElement | undefined

    const isTrendLine = () => props.overlay.name === 'segment'

    // Snapshot original state on open for clean cancel / revert
    const initialOverlayExtend = utils.clone(props.overlay.extendData || {})
    const initialOverlayStyles = utils.clone(props.overlay.styles || {})

    // ================= Fibonacci State =================
    const initialFibSettings = (): any => {
        const last = getLastFibSettings()
        const overlayExtend = props.overlay.extendData || {}
        return {
            ...defaultFibonacciExtendData,
            ...last,
            ...overlayExtend
        }
    }
    const initialFibData = utils.clone(
        props.overlay.extendData?.levels ? props.overlay.extendData : initialFibSettings()
    )
    const [fibExtendData, setFibExtendData] = createSignal(utils.clone(initialFibData))
    const [fibTemplates, setFibTemplates] = createSignal<Array<{ name: string, data: any }>>([])
    const [selectedFibTemplate, setSelectedFibTemplate] = createSignal<string>('Select...')
    const [showSaveFibTemplate, setShowSaveFibTemplate] = createSignal(false)
    const [newFibTemplateName, setNewFibTemplateName] = createSignal('')

    // Auto-apply live changes to Fibonacci retracement
    const updateFibExtendData = (updater: (prev: any) => any) => {
        const next = updater(fibExtendData())
        setFibExtendData(next)
        props.onLiveUpdate?.(next)
    }

    // ================= Trend Line State =================
    const initialTrendSettings = (): TrendLineExtendData => {
        const last = getLastTrendLineSettings()
        const overlayExtend = props.overlay.extendData || {}
        const overlayLineStyles = props.overlay.styles?.line || {}
        return {
            color: overlayLineStyles.color || overlayExtend.color || last.color || '#2962FF',
            size: overlayLineStyles.size ?? overlayExtend.size ?? last.size ?? 2,
            style: overlayLineStyles.style || overlayExtend.style || last.style || 'solid',
            extendLeft: overlayExtend.extendLeft ?? last.extendLeft ?? false,
            extendRight: overlayExtend.extendRight ?? last.extendRight ?? false
        }
    }

    const [trendSettings, setTrendSettings] = createSignal<TrendLineExtendData>(initialTrendSettings())
    const [trendTemplates, setTrendTemplates] = createSignal<Array<{ name: string, data: TrendLineExtendData }>>([])
    const [selectedTrendTemplate, setSelectedTrendTemplate] = createSignal<string>('Select...')
    const [showSaveTrendTemplate, setShowSaveTrendTemplate] = createSignal(false)
    const [newTrendTemplateName, setNewTrendTemplateName] = createSignal('')

    // Auto-apply live changes to chart canvas
    const updateTrendSettings = (updater: (prev: TrendLineExtendData) => TrendLineExtendData) => {
        const next = updater(trendSettings())
        setTrendSettings(next)
        const styles = {
            line: {
                color: next.color,
                size: next.size,
                style: next.style === 'dotted' ? 'dashed' : next.style,
                dashedValue: next.style === 'dotted' ? [2, 2] : [6, 4]
            },
            point: {
                borderColor: next.color,
                activeBorderColor: next.color
            }
        }
        props.onLiveUpdate?.(next, styles)
    }

    // Load templates on mount
    onMount(() => {
        if (isTrendLine()) {
            try {
                const saved = localStorage.getItem('klinecharts_trend_line_templates')
                if (saved) {
                    setTrendTemplates(JSON.parse(saved))
                }
            } catch (e) { }
        } else {
            try {
                const saved = localStorage.getItem('klinecharts_fib_templates')
                if (saved) {
                    setFibTemplates(JSON.parse(saved))
                }
            } catch (e) { }
        }

        setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside)
        }, 50)
    })

    onCleanup(() => {
        document.removeEventListener('mousedown', handleClickOutside)
    })

    // Confirm & Commit Trend Line
    const confirmTrendLine = () => {
        const current = trendSettings()
        saveLastTrendLineSettings(current)
        const styles = {
            line: {
                color: current.color,
                size: current.size,
                style: current.style === 'dotted' ? 'dashed' : current.style,
                dashedValue: current.style === 'dotted' ? [2, 2] : [6, 4]
            },
            point: {
                borderColor: current.color,
                activeBorderColor: current.color
            }
        }
        props.onConfirm(current, styles)
        props.onClose()
    }

    // Cancel & Revert Trend Line
    const cancelTrendLine = () => {
        props.onCancelRevert?.(initialOverlayExtend, initialOverlayStyles)
        props.onClose()
    }

    // Cancel & Revert Fibonacci
    const cancelFibonacci = () => {
        props.onCancelRevert?.(initialFibData, initialOverlayStyles)
        props.onClose()
    }

    // Confirm Fibonacci
    const confirmFibonacci = () => {
        const data = fibExtendData()
        saveLastFibSettings(data)
        props.onConfirm(data)
        props.onClose()
    }

    const handleClickOutside = (e: MouseEvent) => {
        if (panelRef && !panelRef.contains(e.target as Node)) {
            if (isTrendLine()) {
                confirmTrendLine()
            } else {
                confirmFibonacci()
            }
        }
    }

    // ================= Trend Line Template Helpers =================
    const saveTrendTemplate = () => {
        const name = newTrendTemplateName().trim()
        if (!name) return

        const currentTemplates = [...trendTemplates()]
        const existingIdx = currentTemplates.findIndex(t => t.name === name)
        const templateData = { name, data: utils.clone(trendSettings()) }

        if (existingIdx >= 0) {
            currentTemplates[existingIdx] = templateData
        } else {
            currentTemplates.push(templateData)
        }

        setTrendTemplates(currentTemplates)
        setSelectedTrendTemplate(name)
        localStorage.setItem('klinecharts_trend_line_templates', JSON.stringify(currentTemplates))
        window.dispatchEvent(new CustomEvent('klinecharts_trend_line_templates_changed', {
            detail: currentTemplates
        }))

        setShowSaveTrendTemplate(false)
        setNewTrendTemplateName('')
    }

    const applyTrendTemplate = (name: string) => {
        const template = trendTemplates().find(t => t.name === name)
        if (template) {
            updateTrendSettings(() => utils.clone(template.data))
            setSelectedTrendTemplate(name)
        }
    }

    const deleteTrendTemplate = (name: string) => {
        const currentTemplates = trendTemplates().filter(t => t.name !== name)
        setTrendTemplates(currentTemplates)
        localStorage.setItem('klinecharts_trend_line_templates', JSON.stringify(currentTemplates))
        window.dispatchEvent(new CustomEvent('klinecharts_trend_line_templates_changed', {
            detail: currentTemplates
        }))
        if (selectedTrendTemplate() === name) {
            setSelectedTrendTemplate('Select...')
        }
    }

    // ================= Fibonacci Template Helpers =================
    const saveFibTemplate = () => {
        const name = newFibTemplateName().trim()
        if (!name) return

        const currentTemplates = [...fibTemplates()]
        const existingIdx = currentTemplates.findIndex(t => t.name === name)
        const templateData = { name, data: utils.clone(fibExtendData()) }

        if (existingIdx >= 0) {
            currentTemplates[existingIdx] = templateData
        } else {
            currentTemplates.push(templateData)
        }

        setFibTemplates(currentTemplates)
        setSelectedFibTemplate(name)
        localStorage.setItem('klinecharts_fib_templates', JSON.stringify(currentTemplates))
        window.dispatchEvent(new CustomEvent('klinecharts_fib_templates_changed', {
            detail: currentTemplates
        }))

        setShowSaveFibTemplate(false)
        setNewFibTemplateName('')
    }

    const applyFibTemplate = (name: string) => {
        const template = fibTemplates().find(t => t.name === name)
        if (template) {
            updateFibExtendData(() => utils.clone(template.data))
            setSelectedFibTemplate(name)
        }
    }

    const deleteFibTemplate = (name: string) => {
        const currentTemplates = fibTemplates().filter(t => t.name !== name)
        setFibTemplates(currentTemplates)
        localStorage.setItem('klinecharts_fib_templates', JSON.stringify(currentTemplates))
        window.dispatchEvent(new CustomEvent('klinecharts_fib_templates_changed', {
            detail: currentTemplates
        }))
        if (selectedFibTemplate() === name) {
            setSelectedFibTemplate('Select...')
        }
    }

    const alignmentOptions = [
        { key: 'left', text: 'Left' },
        { key: 'center', text: 'Center' },
        { key: 'right', text: 'Right' }
    ]

    const positionOptions = [
        { key: 'top', text: 'Top' },
        { key: 'middle', text: 'Middle' },
        { key: 'bottom', text: 'Bottom' }
    ]

    return (
        <div
            class="klinecharts-pro-overlay-setting-panel"
            ref={panelRef}
            style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                'z-index': '9999',
                width: isTrendLine() ? '300px' : '325px',
                'background-color': '#1e222d',
                border: '1px solid #2a2e39',
                'border-radius': '10px',
                'box-shadow': '0 16px 40px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06)',
                'font-size': '12px',
                color: '#d1d4dc',
                'user-select': 'none',
                'font-family': '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Trebuchet MS", sans-serif',
                overflow: 'visible',
                'box-sizing': 'border-box'
            }}
        >
            {/* Header */}
            <div
                class="panel-header"
                style={{
                    display: 'flex',
                    'align-items': 'center',
                    'justify-content': 'space-between',
                    padding: '12px 14px',
                    'border-bottom': '1px solid #2a2e39',
                    'box-sizing': 'border-box'
                }}
            >
                <div class="header-title-container" style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                    <span class="panel-title" style={{ 'font-size': '13px', 'font-weight': '600', color: '#f0f3fa' }}>
                        {isTrendLine() ? 'Trend Line Settings' : 'Fib Retracement Settings'}
                    </span>
                </div>
                <span
                    class="panel-close"
                    title="Cancel and close"
                    style={{
                        cursor: 'pointer',
                        'font-size': '18px',
                        'line-height': '1',
                        color: '#787b86',
                        transition: 'color 0.15s ease'
                    }}
                    onMouseEnter={(e: any) => e.target.style.color = '#ffffff'}
                    onMouseLeave={(e: any) => e.target.style.color = '#787b86'}
                    onClick={() => {
                        if (isTrendLine()) {
                            cancelTrendLine()
                        } else {
                            cancelFibonacci()
                        }
                    }}>
                    &times;
                </span>
            </div>

            {/* ================= TREND LINE BODY ================= */}
            <Show when={isTrendLine()}>
                <div
                    class="panel-trendline"
                    style={{
                        padding: '14px',
                        display: 'flex',
                        'flex-direction': 'column',
                        gap: '14px',
                        'box-sizing': 'border-box'
                    }}
                >
                    {/* Color Section */}
                    <div
                        class="trend-section"
                        style={{
                            display: 'flex',
                            'flex-direction': 'column',
                            gap: '8px',
                            'box-sizing': 'border-box'
                        }}
                    >
                        <div
                            class="section-row-between"
                            style={{
                                display: 'flex',
                                'align-items': 'center',
                                'justify-content': 'space-between',
                                width: '100%'
                            }}
                        >
                            <span
                                class="section-title"
                                style={{
                                    'font-size': '11px',
                                    'font-weight': '600',
                                    color: '#848e9c',
                                    'text-transform': 'uppercase',
                                    'letter-spacing': '0.5px'
                                }}
                            >
                                Line Color
                            </span>
                            <div
                                class="color-picker-box"
                                style={{
                                    display: 'flex',
                                    'align-items': 'center',
                                    gap: '8px'
                                }}
                            >
                                <label
                                    class="swatch-btn"
                                    title="Click to choose custom color"
                                    style={{
                                        position: 'relative',
                                        width: '26px',
                                        height: '26px',
                                        'border-radius': '6px',
                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        'background-color': trendSettings().color,
                                        'box-shadow': '0 1px 4px rgba(0, 0, 0, 0.4)',
                                        display: 'inline-block',
                                        'flex-shrink': '0',
                                        'box-sizing': 'border-box'
                                    }}
                                >
                                    <input
                                        type="color"
                                        class="hidden-color-input"
                                        value={trendSettings().color}
                                        style={{
                                            position: 'absolute',
                                            top: '-10px',
                                            left: '-10px',
                                            width: '50px',
                                            height: '50px',
                                            opacity: '0',
                                            cursor: 'pointer',
                                            padding: '0',
                                            margin: '0',
                                            border: 'none'
                                        }}
                                        onInput={(e: any) => updateTrendSettings(prev => ({ ...prev, color: e.target.value }))}
                                    />
                                </label>
                                <input
                                    type="text"
                                    class="hex-input"
                                    value={trendSettings().color?.toUpperCase() || ''}
                                    style={{
                                        width: '74px',
                                        height: '26px',
                                        padding: '0 6px',
                                        margin: '0',
                                        background: '#131722',
                                        border: '1px solid #2a2e39',
                                        'border-radius': '6px',
                                        color: '#d1d4dc',
                                        'font-size': '11px',
                                        'font-family': 'monospace',
                                        'text-align': 'center',
                                        outline: 'none',
                                        'box-sizing': 'border-box'
                                    }}
                                    onInput={(e: any) => {
                                        const val = e.target.value.trim()
                                        if (/^#[0-9A-Fa-f]{3,8}$/.test(val)) {
                                            updateTrendSettings(prev => ({ ...prev, color: val }))
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        <div
                            class="palette-dots-row"
                            style={{
                                display: 'flex',
                                'align-items': 'center',
                                'justify-content': 'space-between',
                                width: '100%',
                                'margin-top': '2px'
                            }}
                        >
                            <For each={PRESET_COLORS}>
                                {(preset) => {
                                    const isCurrent = () => trendSettings().color?.toLowerCase() === preset.toLowerCase()
                                    return (
                                        <div
                                            class={`palette-dot ${isCurrent() ? 'active' : ''}`}
                                            title={preset}
                                            style={{
                                                width: '22px',
                                                height: '22px',
                                                'border-radius': '50%',
                                                cursor: 'pointer',
                                                'background-color': preset,
                                                border: isCurrent() ? '2px solid #ffffff' : '2px solid transparent',
                                                'box-shadow': isCurrent() ? '0 0 0 2px #2962ff' : 'none',
                                                transition: 'transform 0.15s, border-color 0.15s',
                                                'box-sizing': 'border-box'
                                            }}
                                            onClick={() => updateTrendSettings(prev => ({ ...prev, color: preset }))}
                                        />
                                    )
                                }}
                            </For>
                        </div>
                    </div>

                    {/* Thickness Section */}
                    <div
                        class="trend-section"
                        style={{
                            display: 'flex',
                            'flex-direction': 'column',
                            gap: '6px',
                            'box-sizing': 'border-box'
                        }}
                    >
                        <span
                            class="section-title"
                            style={{
                                'font-size': '11px',
                                'font-weight': '600',
                                color: '#848e9c',
                                'text-transform': 'uppercase',
                                'letter-spacing': '0.5px'
                            }}
                        >
                            Thickness
                        </span>
                        <div
                            class="thickness-segmented-bar"
                            style={{
                                display: 'flex',
                                gap: '4px',
                                background: '#131722',
                                padding: '3px',
                                'border-radius': '8px',
                                border: '1px solid #2a2e39',
                                'box-sizing': 'border-box',
                                width: '100%'
                            }}
                        >
                            <For each={[1, 2, 3, 4]}>
                                {(thick) => {
                                    const isActive = () => trendSettings().size === thick
                                    return (
                                        <div
                                            class={`segmented-item ${isActive() ? 'active' : ''}`}
                                            style={{
                                                flex: '1',
                                                height: '36px',
                                                display: 'flex',
                                                'flex-direction': 'column',
                                                'align-items': 'center',
                                                'justify-content': 'center',
                                                gap: '5px',
                                                'border-radius': '6px',
                                                cursor: 'pointer',
                                                background: isActive() ? 'rgba(41, 98, 255, 0.18)' : 'transparent',
                                                border: isActive() ? '1px solid #2962ff' : '1px solid transparent',
                                                transition: 'all 0.15s ease',
                                                'box-sizing': 'border-box'
                                            }}
                                            onClick={() => updateTrendSettings(prev => ({ ...prev, size: thick }))}
                                        >
                                            <div
                                                class="thickness-bar"
                                                style={{
                                                    width: '26px',
                                                    height: `${thick}px`,
                                                    'border-radius': '1px',
                                                    'background-color': isActive() ? (trendSettings().color || '#2962ff') : 'rgba(255,255,255,0.6)',
                                                    transition: 'background-color 0.15s'
                                                }}
                                            />
                                            <span
                                                class="item-label"
                                                style={{
                                                    'font-size': '10px',
                                                    color: isActive() ? '#2962ff' : '#787b86',
                                                    'font-weight': isActive() ? '600' : 'normal',
                                                    'line-height': '1'
                                                }}
                                            >
                                                {thick}px
                                            </span>
                                        </div>
                                    )
                                }}
                            </For>
                        </div>
                    </div>

                    {/* Line Style Section */}
                    <div
                        class="trend-section"
                        style={{
                            display: 'flex',
                            'flex-direction': 'column',
                            gap: '6px',
                            'box-sizing': 'border-box'
                        }}
                    >
                        <span
                            class="section-title"
                            style={{
                                'font-size': '11px',
                                'font-weight': '600',
                                color: '#848e9c',
                                'text-transform': 'uppercase',
                                'letter-spacing': '0.5px'
                            }}
                        >
                            Line Style
                        </span>
                        <div
                            class="style-segmented-bar"
                            style={{
                                display: 'flex',
                                gap: '4px',
                                background: '#131722',
                                padding: '3px',
                                'border-radius': '8px',
                                border: '1px solid #2a2e39',
                                'box-sizing': 'border-box',
                                width: '100%'
                            }}
                        >
                            <For each={[
                                { key: 'solid', label: 'Solid' },
                                { key: 'dashed', label: 'Dashed' },
                                { key: 'dotted', label: 'Dotted' }
                            ]}>
                                {(item) => {
                                    const isActive = () => trendSettings().style === item.key
                                    return (
                                        <div
                                            class={`style-item ${isActive() ? 'active' : ''}`}
                                            style={{
                                                flex: '1',
                                                height: '28px',
                                                display: 'flex',
                                                'align-items': 'center',
                                                'justify-content': 'center',
                                                'border-radius': '6px',
                                                'font-size': '11px',
                                                cursor: 'pointer',
                                                background: isActive() ? '#2a2e39' : 'transparent',
                                                color: isActive() ? '#ffffff' : '#787b86',
                                                'font-weight': isActive() ? '600' : 'normal',
                                                'box-shadow': isActive() ? '0 1px 3px rgba(0, 0, 0, 0.3)' : 'none',
                                                transition: 'all 0.15s ease',
                                                'box-sizing': 'border-box'
                                            }}
                                            onClick={() => updateTrendSettings(prev => ({ ...prev, style: item.key as any }))}
                                        >
                                            <span>{item.label}</span>
                                        </div>
                                    )
                                }}
                            </For>
                        </div>
                    </div>

                    {/* Extension Toggles */}
                    <div
                        class="trend-section"
                        style={{
                            display: 'flex',
                            'flex-direction': 'column',
                            gap: '6px',
                            'box-sizing': 'border-box'
                        }}
                    >
                        <span
                            class="section-title"
                            style={{
                                'font-size': '11px',
                                'font-weight': '600',
                                color: '#848e9c',
                                'text-transform': 'uppercase',
                                'letter-spacing': '0.5px'
                            }}
                        >
                            Extensions
                        </span>
                        <div
                            class="extend-pills-row"
                            style={{
                                display: 'flex',
                                gap: '8px',
                                width: '100%'
                            }}
                        >
                            <div
                                class={`extend-pill ${trendSettings().extendLeft ? 'active' : ''}`}
                                style={{
                                    flex: '1',
                                    height: '32px',
                                    display: 'flex',
                                    'align-items': 'center',
                                    'justify-content': 'center',
                                    gap: '6px',
                                    background: trendSettings().extendLeft ? 'rgba(41, 98, 255, 0.15)' : '#131722',
                                    border: trendSettings().extendLeft ? '1px solid #2962ff' : '1px solid #2a2e39',
                                    'border-radius': '6px',
                                    'font-size': '11px',
                                    color: trendSettings().extendLeft ? '#ffffff' : '#787b86',
                                    cursor: 'pointer',
                                    'user-select': 'none',
                                    transition: 'all 0.15s ease',
                                    'box-sizing': 'border-box'
                                }}
                                onClick={() => updateTrendSettings(prev => ({ ...prev, extendLeft: !prev.extendLeft }))}
                            >
                                <span
                                    class={`pill-check ${trendSettings().extendLeft ? 'checked' : ''}`}
                                    style={{
                                        width: '14px',
                                        height: '14px',
                                        'border-radius': '3px',
                                        border: trendSettings().extendLeft ? '1px solid #2962ff' : '1px solid #434651',
                                        background: trendSettings().extendLeft ? '#2962ff' : 'transparent',
                                        display: 'flex',
                                        'align-items': 'center',
                                        'justify-content': 'center',
                                        'font-size': '10px',
                                        'line-height': '1',
                                        color: '#ffffff',
                                        'box-sizing': 'border-box'
                                    }}
                                >
                                    {trendSettings().extendLeft ? '✓' : ''}
                                </span>
                                <span>Extend Left</span>
                            </div>
                            <div
                                class={`extend-pill ${trendSettings().extendRight ? 'active' : ''}`}
                                style={{
                                    flex: '1',
                                    height: '32px',
                                    display: 'flex',
                                    'align-items': 'center',
                                    'justify-content': 'center',
                                    gap: '6px',
                                    background: trendSettings().extendRight ? 'rgba(41, 98, 255, 0.15)' : '#131722',
                                    border: trendSettings().extendRight ? '1px solid #2962ff' : '1px solid #2a2e39',
                                    'border-radius': '6px',
                                    'font-size': '11px',
                                    color: trendSettings().extendRight ? '#ffffff' : '#787b86',
                                    cursor: 'pointer',
                                    'user-select': 'none',
                                    transition: 'all 0.15s ease',
                                    'box-sizing': 'border-box'
                                }}
                                onClick={() => updateTrendSettings(prev => ({ ...prev, extendRight: !prev.extendRight }))}
                            >
                                <span
                                    class={`pill-check ${trendSettings().extendRight ? 'checked' : ''}`}
                                    style={{
                                        width: '14px',
                                        height: '14px',
                                        'border-radius': '3px',
                                        border: trendSettings().extendRight ? '1px solid #2962ff' : '1px solid #434651',
                                        background: trendSettings().extendRight ? '#2962ff' : 'transparent',
                                        display: 'flex',
                                        'align-items': 'center',
                                        'justify-content': 'center',
                                        'font-size': '10px',
                                        'line-height': '1',
                                        color: '#ffffff',
                                        'box-sizing': 'border-box'
                                    }}
                                >
                                    {trendSettings().extendRight ? '✓' : ''}
                                </span>
                                <span>Extend Right</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trend Line Template Action Bar */}
                <div
                    class="panel-footer-clean"
                    style={{
                        padding: '10px 14px 12px',
                        'border-top': '1px solid #2a2e39',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'space-between',
                        'box-sizing': 'border-box',
                        width: '100%',
                        'margin-top': '4px'
                    }}
                >
                    <div
                        class="template-control-group"
                        style={{
                            display: 'flex',
                            'align-items': 'center',
                            gap: '6px'
                        }}
                    >
                        <span class="template-label" style={{ 'font-size': '11px', color: '#787b86' }}>Template</span>
                        <Select
                            class="template-select-clean"
                            style={{ width: '105px' }}
                            value={selectedTrendTemplate()}
                            dataSource={[
                                { key: 'save_new', text: '+ Save As...' },
                                ...trendTemplates().map(t => ({ key: t.name, text: t.name }))
                            ]}
                            onSelected={(v: any) => {
                                if (v.key === 'save_new') {
                                    setShowSaveTrendTemplate(true)
                                } else {
                                    applyTrendTemplate(v.key)
                                }
                            }}
                        />
                        <Show when={selectedTrendTemplate() !== 'Select...' && selectedTrendTemplate() !== '+ Save As...'}>
                            <button
                                type="button"
                                class="btn-delete-template"
                                title="Delete template"
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: '#f23645',
                                    'font-size': '16px',
                                    'line-height': '1',
                                    padding: '0 4px'
                                }}
                                onClick={() => deleteTrendTemplate(selectedTrendTemplate())}>
                                &times;
                            </button>
                        </Show>
                    </div>
                    <div
                        class="dialog-action-buttons"
                        style={{
                            display: 'flex',
                            'align-items': 'center',
                            gap: '8px'
                        }}
                    >
                        <button
                            type="button"
                            class="btn-cancel-clean"
                            style={{
                                'box-sizing': 'border-box',
                                height: '28px',
                                padding: '0 12px',
                                'border-radius': '5px',
                                background: 'transparent',
                                border: '1px solid #363a45',
                                color: '#d1d4dc',
                                'font-size': '11px',
                                'font-weight': '500',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                            }}
                            onClick={cancelTrendLine}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="btn-ok-clean"
                            style={{
                                'box-sizing': 'border-box',
                                height: '28px',
                                padding: '0 16px',
                                'border-radius': '5px',
                                background: '#2962ff',
                                border: '1px solid #2962ff',
                                color: '#ffffff',
                                'font-size': '11px',
                                'font-weight': '600',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                'box-shadow': '0 1px 4px rgba(41, 98, 255, 0.4)'
                            }}
                            onClick={confirmTrendLine}>
                            Ok
                        </button>
                    </div>
                </div>

                {/* Save Trend Line Template Dialog */}
                <Show when={showSaveTrendTemplate()}>
                    <div
                        class="save-template-overlay"
                        style={{
                            position: 'absolute',
                            top: '0',
                            left: '0',
                            right: '0',
                            bottom: '0',
                            background: 'rgba(0, 0, 0, 0.8)',
                            display: 'flex',
                            'align-items': 'center',
                            'justify-content': 'center',
                            'z-index': '100',
                            'border-radius': '10px'
                        }}
                    >
                        <div
                            class="save-template-dialog"
                            style={{
                                background: '#1e222d',
                                padding: '16px',
                                'border-radius': '8px',
                                width: '250px',
                                display: 'flex',
                                'flex-direction': 'column',
                                gap: '12px',
                                border: '1px solid #2a2e39',
                                'box-shadow': '0 8px 24px rgba(0, 0, 0, 0.6)',
                                'box-sizing': 'border-box'
                            }}
                        >
                            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                                <span style={{ 'font-size': '12px', 'font-weight': '600', color: '#f0f3fa' }}>Save drawing template</span>
                                <span
                                    style={{ cursor: 'pointer', 'font-size': '18px', color: '#787b86', 'line-height': '1' }}
                                    onClick={() => setShowSaveTrendTemplate(false)}>&times;</span>
                            </div>
                            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '5px' }}>
                                <span style={{ 'font-size': '11px', color: '#787b86' }}>Template name</span>
                                <input
                                    type="text"
                                    class="template-name-input"
                                    value={newTrendTemplateName()}
                                    onInput={(e: any) => setNewTrendTemplateName(e.target.value)}
                                    placeholder="e.g. Key Resistance"
                                    style={{
                                        width: '100%',
                                        background: '#131722',
                                        border: '1px solid #2a2e39',
                                        color: '#d1d4dc',
                                        padding: '6px 8px',
                                        'border-radius': '5px',
                                        'font-size': '12px',
                                        outline: 'none',
                                        'box-sizing': 'border-box'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '8px', 'margin-top': '4px' }}>
                                <button
                                    type="button"
                                    class="btn-cancel-clean"
                                    style={{
                                        height: '26px',
                                        padding: '0 10px',
                                        background: 'transparent',
                                        border: '1px solid #363a45',
                                        color: '#d1d4dc',
                                        'border-radius': '4px',
                                        cursor: 'pointer',
                                        'font-size': '11px'
                                    }}
                                    onClick={() => setShowSaveTrendTemplate(false)}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    class="btn-ok-clean"
                                    style={{
                                        height: '26px',
                                        padding: '0 12px',
                                        background: '#2962ff',
                                        border: '1px solid #2962ff',
                                        color: '#fff',
                                        'border-radius': '4px',
                                        cursor: 'pointer',
                                        'font-size': '11px',
                                        'font-weight': '600'
                                    }}
                                    onClick={saveTrendTemplate}>
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </Show>
            </Show>

            {/* ================= FIBONACCI BODY ================= */}
            <Show when={!isTrendLine()}>
                <div
                    class="panel-fibonacci"
                    style={{
                        padding: '14px',
                        display: 'flex',
                        'flex-direction': 'column',
                        gap: '14px',
                        'box-sizing': 'border-box'
                    }}
                >
                    {/* Extensions Section */}
                    <div
                        style={{
                            display: 'flex',
                            'flex-direction': 'column',
                            gap: '6px',
                            'box-sizing': 'border-box'
                        }}
                    >
                        <span
                            style={{
                                'font-size': '11px',
                                'font-weight': '600',
                                color: '#848e9c',
                                'text-transform': 'uppercase',
                                'letter-spacing': '0.5px'
                            }}
                        >
                            Extensions
                        </span>
                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <div
                                class={`extend-pill ${fibExtendData().extendLeft ? 'active' : ''}`}
                                style={{
                                    flex: '1',
                                    height: '32px',
                                    display: 'flex',
                                    'align-items': 'center',
                                    'justify-content': 'center',
                                    gap: '6px',
                                    background: fibExtendData().extendLeft ? 'rgba(41, 98, 255, 0.15)' : '#131722',
                                    border: fibExtendData().extendLeft ? '1px solid #2962ff' : '1px solid #2a2e39',
                                    'border-radius': '6px',
                                    'font-size': '11px',
                                    color: fibExtendData().extendLeft ? '#ffffff' : '#787b86',
                                    cursor: 'pointer',
                                    'user-select': 'none',
                                    transition: 'all 0.15s ease',
                                    'box-sizing': 'border-box'
                                }}
                                onClick={() => updateFibExtendData(prev => ({ ...prev, extendLeft: !prev.extendLeft }))}
                            >
                                <span
                                    class={`pill-check ${fibExtendData().extendLeft ? 'checked' : ''}`}
                                    style={{
                                        width: '14px',
                                        height: '14px',
                                        'border-radius': '3px',
                                        border: fibExtendData().extendLeft ? '1px solid #2962ff' : '1px solid #434651',
                                        background: fibExtendData().extendLeft ? '#2962ff' : 'transparent',
                                        display: 'flex',
                                        'align-items': 'center',
                                        'justify-content': 'center',
                                        'font-size': '10px',
                                        'line-height': '1',
                                        color: '#ffffff',
                                        'box-sizing': 'border-box'
                                    }}
                                >
                                    {fibExtendData().extendLeft ? '✓' : ''}
                                </span>
                                <span>Extend Left</span>
                            </div>
                            <div
                                class={`extend-pill ${fibExtendData().extendRight ? 'active' : ''}`}
                                style={{
                                    flex: '1',
                                    height: '32px',
                                    display: 'flex',
                                    'align-items': 'center',
                                    'justify-content': 'center',
                                    gap: '6px',
                                    background: fibExtendData().extendRight ? 'rgba(41, 98, 255, 0.15)' : '#131722',
                                    border: fibExtendData().extendRight ? '1px solid #2962ff' : '1px solid #2a2e39',
                                    'border-radius': '6px',
                                    'font-size': '11px',
                                    color: fibExtendData().extendRight ? '#ffffff' : '#787b86',
                                    cursor: 'pointer',
                                    'user-select': 'none',
                                    transition: 'all 0.15s ease',
                                    'box-sizing': 'border-box'
                                }}
                                onClick={() => updateFibExtendData(prev => ({ ...prev, extendRight: !prev.extendRight }))}
                            >
                                <span
                                    class={`pill-check ${fibExtendData().extendRight ? 'checked' : ''}`}
                                    style={{
                                        width: '14px',
                                        height: '14px',
                                        'border-radius': '3px',
                                        border: fibExtendData().extendRight ? '1px solid #2962ff' : '1px solid #434651',
                                        background: fibExtendData().extendRight ? '#2962ff' : 'transparent',
                                        display: 'flex',
                                        'align-items': 'center',
                                        'justify-content': 'center',
                                        'font-size': '10px',
                                        'line-height': '1',
                                        color: '#ffffff',
                                        'box-sizing': 'border-box'
                                    }}
                                >
                                    {fibExtendData().extendRight ? '✓' : ''}
                                </span>
                                <span>Extend Right</span>
                            </div>
                        </div>
                    </div>

                    {/* Label Alignment & Position Section */}
                    <div
                        style={{
                            display: 'flex',
                            'flex-direction': 'column',
                            gap: '8px',
                            'box-sizing': 'border-box'
                        }}
                    >
                        {/* Label Alignment */}
                        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '5px' }}>
                            <span
                                style={{
                                    'font-size': '11px',
                                    'font-weight': '600',
                                    color: '#848e9c',
                                    'text-transform': 'uppercase',
                                    'letter-spacing': '0.5px'
                                }}
                            >
                                Label Alignment
                            </span>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '4px',
                                    background: '#131722',
                                    padding: '3px',
                                    'border-radius': '8px',
                                    border: '1px solid #2a2e39',
                                    'box-sizing': 'border-box',
                                    width: '100%'
                                }}
                            >
                                <For each={[
                                    { key: 'left', label: 'Left' },
                                    { key: 'center', label: 'Center' },
                                    { key: 'right', label: 'Right' }
                                ]}>
                                    {(item) => {
                                        const isActive = () => (fibExtendData().labelAlignment || 'right') === item.key
                                        return (
                                            <div
                                                style={{
                                                    flex: '1',
                                                    height: '26px',
                                                    display: 'flex',
                                                    'align-items': 'center',
                                                    'justify-content': 'center',
                                                    'border-radius': '6px',
                                                    'font-size': '11px',
                                                    cursor: 'pointer',
                                                    background: isActive() ? '#2a2e39' : 'transparent',
                                                    color: isActive() ? '#ffffff' : '#787b86',
                                                    'font-weight': isActive() ? '600' : 'normal',
                                                    'box-shadow': isActive() ? '0 1px 3px rgba(0, 0, 0, 0.3)' : 'none',
                                                    transition: 'all 0.15s ease',
                                                    'box-sizing': 'border-box'
                                                }}
                                                onClick={() => updateFibExtendData(prev => ({ ...prev, labelAlignment: item.key }))}
                                            >
                                                <span>{item.label}</span>
                                            </div>
                                        )
                                    }}
                                </For>
                            </div>
                        </div>

                        {/* Label Position */}
                        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '5px' }}>
                            <span
                                style={{
                                    'font-size': '11px',
                                    'font-weight': '600',
                                    color: '#848e9c',
                                    'text-transform': 'uppercase',
                                    'letter-spacing': '0.5px'
                                }}
                            >
                                Label Position
                            </span>
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '4px',
                                    background: '#131722',
                                    padding: '3px',
                                    'border-radius': '8px',
                                    border: '1px solid #2a2e39',
                                    'box-sizing': 'border-box',
                                    width: '100%'
                                }}
                            >
                                <For each={[
                                    { key: 'top', label: 'Top' },
                                    { key: 'middle', label: 'Middle' },
                                    { key: 'bottom', label: 'Bottom' }
                                ]}>
                                    {(item) => {
                                        const isActive = () => (fibExtendData().labelPosition || 'top') === item.key
                                        return (
                                            <div
                                                style={{
                                                    flex: '1',
                                                    height: '26px',
                                                    display: 'flex',
                                                    'align-items': 'center',
                                                    'justify-content': 'center',
                                                    'border-radius': '6px',
                                                    'font-size': '11px',
                                                    cursor: 'pointer',
                                                    background: isActive() ? '#2a2e39' : 'transparent',
                                                    color: isActive() ? '#ffffff' : '#787b86',
                                                    'font-weight': isActive() ? '600' : 'normal',
                                                    'box-shadow': isActive() ? '0 1px 3px rgba(0, 0, 0, 0.3)' : 'none',
                                                    transition: 'all 0.15s ease',
                                                    'box-sizing': 'border-box'
                                                }}
                                                onClick={() => updateFibExtendData(prev => ({ ...prev, labelPosition: item.key }))}
                                            >
                                                <span>{item.label}</span>
                                            </div>
                                        )
                                    }}
                                </For>
                            </div>
                        </div>
                    </div>

                    {/* Fibonacci Levels Section */}
                    <div
                        style={{
                            display: 'flex',
                            'flex-direction': 'column',
                            gap: '6px',
                            'box-sizing': 'border-box'
                        }}
                    >
                        <span
                            style={{
                                'font-size': '11px',
                                'font-weight': '600',
                                color: '#848e9c',
                                'text-transform': 'uppercase',
                                'letter-spacing': '0.5px'
                            }}
                        >
                            Levels
                        </span>
                        <div
                            class="custom-fib-scrollbar"
                            style={{
                                'max-height': '200px',
                                'overflow-y': 'auto',
                                'overflow-x': 'hidden',
                                display: 'flex',
                                'flex-direction': 'column',
                                gap: '6px',
                                'padding-right': '4px',
                                'box-sizing': 'border-box'
                            }}
                        >
                            <For each={fibExtendData().levels}>
                                {(level, index) => (
                                    <div
                                        style={{
                                            display: 'flex',
                                            'align-items': 'center',
                                            gap: '8px',
                                            background: '#131722',
                                            padding: '4px 8px',
                                            'border-radius': '6px',
                                            border: '1px solid #2a2e39',
                                            'box-sizing': 'border-box',
                                            width: '100%'
                                        }}
                                    >
                                        {/* Visibility Checkbox */}
                                        <div
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                'border-radius': '3px',
                                                border: level.visible ? '1px solid #2962ff' : '1px solid #434651',
                                                background: level.visible ? '#2962ff' : 'transparent',
                                                display: 'flex',
                                                'align-items': 'center',
                                                'justify-content': 'center',
                                                'font-size': '11px',
                                                'line-height': '1',
                                                color: '#ffffff',
                                                cursor: 'pointer',
                                                'flex-shrink': '0',
                                                'box-sizing': 'border-box'
                                            }}
                                            onClick={() => {
                                                updateFibExtendData(prev => {
                                                    const newLevels = [...prev.levels]
                                                    newLevels[index()] = { ...newLevels[index()], visible: !newLevels[index()].visible }
                                                    return { ...prev, levels: newLevels }
                                                })
                                            }}
                                        >
                                            {level.visible ? '✓' : ''}
                                        </div>

                                        {/* Value Input */}
                                        <input
                                            type="number"
                                            step="0.001"
                                            value={level.value}
                                            style={{
                                                flex: '1',
                                                'min-width': '0',
                                                height: '26px',
                                                padding: '0 8px',
                                                margin: '0',
                                                background: '#1e222d',
                                                border: '1px solid #2a2e39',
                                                'border-radius': '4px',
                                                color: level.visible ? '#d1d4dc' : '#5d6370',
                                                'font-size': '12px',
                                                'font-family': 'monospace',
                                                outline: 'none',
                                                'box-sizing': 'border-box'
                                            }}
                                            onInput={(e: any) => {
                                                const val = parseFloat(e.target.value)
                                                if (!isNaN(val)) {
                                                    updateFibExtendData(prev => {
                                                        const newLevels = [...prev.levels]
                                                        newLevels[index()] = { ...newLevels[index()], value: val }
                                                        return { ...prev, levels: newLevels }
                                                    })
                                                }
                                            }}
                                        />

                                        {/* Color Swatch Trigger */}
                                        <label
                                            title="Pick level color"
                                            style={{
                                                position: 'relative',
                                                width: '24px',
                                                height: '24px',
                                                'border-radius': '5px',
                                                border: '2px solid rgba(255, 255, 255, 0.25)',
                                                cursor: 'pointer',
                                                overflow: 'hidden',
                                                'background-color': level.color,
                                                'box-shadow': '0 1px 3px rgba(0,0,0,0.4)',
                                                display: 'inline-block',
                                                'flex-shrink': '0',
                                                'box-sizing': 'border-box'
                                            }}
                                        >
                                            <input
                                                type="color"
                                                value={level.color}
                                                style={{
                                                    position: 'absolute',
                                                    top: '-10px',
                                                    left: '-10px',
                                                    width: '50px',
                                                    height: '50px',
                                                    opacity: '0',
                                                    cursor: 'pointer',
                                                    padding: '0',
                                                    margin: '0',
                                                    border: 'none'
                                                }}
                                                onInput={(e: any) => {
                                                    const colorVal = e.target.value
                                                    updateFibExtendData(prev => {
                                                        const newLevels = [...prev.levels]
                                                        newLevels[index()] = { ...newLevels[index()], color: colorVal }
                                                        return { ...prev, levels: newLevels }
                                                    })
                                                }}
                                            />
                                        </label>

                                        {/* Remove Level */}
                                        <span
                                            title="Remove level"
                                            style={{
                                                cursor: 'pointer',
                                                color: '#787b86',
                                                'font-size': '16px',
                                                'line-height': '1',
                                                padding: '0 4px',
                                                transition: 'color 0.15s'
                                            }}
                                            onMouseEnter={(e: any) => e.target.style.color = '#f23645'}
                                            onMouseLeave={(e: any) => e.target.style.color = '#787b86'}
                                            onClick={() => {
                                                updateFibExtendData(prev => {
                                                    const newLevels = [...prev.levels]
                                                    newLevels.splice(index(), 1)
                                                    return { ...prev, levels: newLevels }
                                                })
                                            }}
                                        >
                                            &times;
                                        </span>
                                    </div>
                                )}
                            </For>
                        </div>

                        {/* + Add Level Button */}
                        <button
                            type="button"
                            style={{
                                width: '100%',
                                height: '28px',
                                background: '#131722',
                                border: '1px dashed #2a2e39',
                                'border-radius': '6px',
                                color: '#2962ff',
                                'font-size': '11px',
                                'font-weight': '600',
                                cursor: 'pointer',
                                display: 'flex',
                                'align-items': 'center',
                                'justify-content': 'center',
                                gap: '4px',
                                transition: 'all 0.15s ease',
                                'margin-top': '2px',
                                'box-sizing': 'border-box'
                            }}
                            onMouseEnter={(e: any) => {
                                e.target.style.borderColor = '#2962ff'
                                e.target.style.background = 'rgba(41, 98, 255, 0.08)'
                            }}
                            onMouseLeave={(e: any) => {
                                e.target.style.borderColor = '#2a2e39'
                                e.target.style.background = '#131722'
                            }}
                            onClick={() => {
                                updateFibExtendData(prev => ({
                                    ...prev,
                                    levels: [...prev.levels, { value: 0, color: '#787B86', visible: true }]
                                }))
                            }}
                        >
                            + Add Level
                        </button>
                    </div>
                </div>

                {/* Fibonacci Template & Action Bar Footer */}
                <div
                    class="panel-footer-clean"
                    style={{
                        padding: '10px 14px 12px',
                        'border-top': '1px solid #2a2e39',
                        display: 'flex',
                        'align-items': 'center',
                        'justify-content': 'space-between',
                        'box-sizing': 'border-box',
                        width: '100%',
                        'margin-top': '4px'
                    }}
                >
                    <div
                        class="template-control-group"
                        style={{
                            display: 'flex',
                            'align-items': 'center',
                            gap: '6px'
                        }}
                    >
                        <span class="template-label" style={{ 'font-size': '11px', color: '#787b86' }}>Template</span>
                        <Select
                            class="template-select-clean"
                            style={{ width: '105px' }}
                            value={selectedFibTemplate()}
                            dataSource={[
                                { key: 'save_new', text: '+ Save As...' },
                                ...fibTemplates().map(t => ({ key: t.name, text: t.name }))
                            ]}
                            onSelected={(v: any) => {
                                if (v.key === 'save_new') {
                                    setShowSaveFibTemplate(true)
                                } else {
                                    applyFibTemplate(v.key)
                                }
                            }}
                        />
                        <Show when={selectedFibTemplate() !== 'Select...' && selectedFibTemplate() !== '+ Save As...'}>
                            <button
                                type="button"
                                class="btn-delete-template"
                                title="Delete template"
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    color: '#f23645',
                                    'font-size': '16px',
                                    'line-height': '1',
                                    padding: '0 4px'
                                }}
                                onClick={() => deleteFibTemplate(selectedFibTemplate())}>
                                &times;
                            </button>
                        </Show>
                    </div>
                    <div
                        class="dialog-action-buttons"
                        style={{
                            display: 'flex',
                            'align-items': 'center',
                            gap: '8px'
                        }}
                    >
                        <button
                            type="button"
                            class="btn-cancel-clean"
                            style={{
                                'box-sizing': 'border-box',
                                height: '28px',
                                padding: '0 12px',
                                'border-radius': '5px',
                                background: 'transparent',
                                border: '1px solid #363a45',
                                color: '#d1d4dc',
                                'font-size': '11px',
                                'font-weight': '500',
                                cursor: 'pointer',
                                transition: 'all 0.15s'
                            }}
                            onClick={cancelFibonacci}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="btn-ok-clean"
                            style={{
                                'box-sizing': 'border-box',
                                height: '28px',
                                padding: '0 16px',
                                'border-radius': '5px',
                                background: '#2962ff',
                                border: '1px solid #2962ff',
                                color: '#ffffff',
                                'font-size': '11px',
                                'font-weight': '600',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                'box-shadow': '0 1px 4px rgba(41, 98, 255, 0.4)'
                            }}
                            onClick={confirmFibonacci}>
                            Ok
                        </button>
                    </div>
                </div>

                {/* Save Fibonacci Template Dialog */}
                <Show when={showSaveFibTemplate()}>
                    <div
                        class="save-template-overlay"
                        style={{
                            position: 'absolute',
                            top: '0',
                            left: '0',
                            right: '0',
                            bottom: '0',
                            background: 'rgba(0, 0, 0, 0.8)',
                            display: 'flex',
                            'align-items': 'center',
                            'justify-content': 'center',
                            'z-index': '100',
                            'border-radius': '10px'
                        }}
                    >
                        <div
                            class="save-template-dialog"
                            style={{
                                background: '#1e222d',
                                padding: '16px',
                                'border-radius': '8px',
                                width: '250px',
                                display: 'flex',
                                'flex-direction': 'column',
                                gap: '12px',
                                border: '1px solid #2a2e39',
                                'box-shadow': '0 8px 24px rgba(0, 0, 0, 0.6)',
                                'box-sizing': 'border-box'
                            }}
                        >
                            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                                <span style={{ 'font-size': '12px', 'font-weight': '600', color: '#f0f3fa' }}>Save drawing template</span>
                                <span
                                    style={{ cursor: 'pointer', 'font-size': '18px', color: '#787b86', 'line-height': '1' }}
                                    onClick={() => setShowSaveFibTemplate(false)}>&times;</span>
                            </div>
                            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '5px' }}>
                                <span style={{ 'font-size': '11px', color: '#787b86' }}>Template name</span>
                                <input
                                    type="text"
                                    class="template-name-input"
                                    value={newFibTemplateName()}
                                    onInput={(e: any) => setNewFibTemplateName(e.target.value)}
                                    placeholder="e.g. Golden Pocket"
                                    style={{
                                        width: '100%',
                                        background: '#131722',
                                        border: '1px solid #2a2e39',
                                        color: '#d1d4dc',
                                        padding: '6px 8px',
                                        'border-radius': '5px',
                                        'font-size': '12px',
                                        outline: 'none',
                                        'box-sizing': 'border-box'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '8px', 'margin-top': '4px' }}>
                                <button
                                    type="button"
                                    class="btn-cancel-clean"
                                    style={{
                                        height: '26px',
                                        padding: '0 10px',
                                        background: 'transparent',
                                        border: '1px solid #363a45',
                                        color: '#d1d4dc',
                                        'border-radius': '4px',
                                        cursor: 'pointer',
                                        'font-size': '11px'
                                    }}
                                    onClick={() => setShowSaveFibTemplate(false)}>
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    class="btn-ok-clean"
                                    style={{
                                        height: '26px',
                                        padding: '0 12px',
                                        background: '#2962ff',
                                        border: '1px solid #2962ff',
                                        color: '#fff',
                                        'border-radius': '4px',
                                        cursor: 'pointer',
                                        'font-size': '11px',
                                        'font-weight': '600'
                                    }}
                                    onClick={saveFibTemplate}>
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    )
}

export default OverlaySettingModal
