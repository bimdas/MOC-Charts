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
    const [fibExtendData, setFibExtendData] = createSignal(
        utils.clone(props.overlay.extendData || defaultFibonacciExtendData)
    )
    const [fibTemplates, setFibTemplates] = createSignal<Array<{ name: string, data: any }>>([])
    const [showSaveFibTemplate, setShowSaveFibTemplate] = createSignal(false)
    const [newFibTemplateName, setNewFibTemplateName] = createSignal('')

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
            setFibExtendData(utils.clone(template.data))
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
        <div class="klinecharts-pro-overlay-setting-panel" ref={panelRef}>
            {/* Header */}
            <div class="panel-header">
                <div class="header-title-container">
                    <span class="panel-title">{isTrendLine() ? 'Trend Line Settings' : 'Fib Settings'}</span>
                </div>
                <span
                    class="panel-close"
                    title="Cancel and close"
                    onClick={() => {
                        if (isTrendLine()) {
                            cancelTrendLine()
                        } else {
                            props.onClose()
                        }
                    }}>
                    &times;
                </span>
            </div>

            {/* ================= TREND LINE BODY ================= */}
            <Show when={isTrendLine()}>
                <div class="panel-trendline">
                    {/* Color Section */}
                    <div class="trend-section">
                        <div class="section-row-between">
                            <span class="section-title">Line Color</span>
                            <div class="color-picker-box">
                                <label
                                    class="swatch-btn"
                                    title="Click to choose custom color"
                                    style={{ "background-color": trendSettings().color }}>
                                    <input
                                        type="color"
                                        class="hidden-color-input"
                                        value={trendSettings().color}
                                        onInput={(e: any) => updateTrendSettings(prev => ({ ...prev, color: e.target.value }))}
                                    />
                                </label>
                                <input
                                    type="text"
                                    class="hex-input"
                                    value={trendSettings().color?.toUpperCase() || ''}
                                    onInput={(e: any) => {
                                        const val = e.target.value.trim()
                                        if (/^#[0-9A-Fa-f]{3,8}$/.test(val)) {
                                            updateTrendSettings(prev => ({ ...prev, color: val }))
                                        }
                                    }}
                                />
                            </div>
                        </div>
                        <div class="palette-dots-row">
                            <For each={PRESET_COLORS}>
                                {(preset) => (
                                    <div
                                        class={`palette-dot ${trendSettings().color?.toLowerCase() === preset.toLowerCase() ? 'active' : ''}`}
                                        style={{ "background-color": preset }}
                                        title={preset}
                                        onClick={() => updateTrendSettings(prev => ({ ...prev, color: preset }))}
                                    />
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Thickness Section */}
                    <div class="trend-section">
                        <span class="section-title">Thickness</span>
                        <div class="thickness-segmented-bar">
                            <For each={[1, 2, 3, 4]}>
                                {(thick) => (
                                    <div
                                        class={`segmented-item ${trendSettings().size === thick ? 'active' : ''}`}
                                        onClick={() => updateTrendSettings(prev => ({ ...prev, size: thick }))}>
                                        <div
                                            class="thickness-bar"
                                            style={{
                                                height: `${thick}px`,
                                                "background-color": trendSettings().size === thick ? (trendSettings().color || '#2962ff') : 'rgba(255,255,255,0.7)'
                                            }}
                                        />
                                        <span class="item-label">{thick}px</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Line Style Section */}
                    <div class="trend-section">
                        <span class="section-title">Line Style</span>
                        <div class="style-segmented-bar">
                            <For each={[
                                { key: 'solid', label: 'Solid' },
                                { key: 'dashed', label: 'Dashed' },
                                { key: 'dotted', label: 'Dotted' }
                            ]}>
                                {(item) => (
                                    <div
                                        class={`style-item ${trendSettings().style === item.key ? 'active' : ''}`}
                                        onClick={() => updateTrendSettings(prev => ({ ...prev, style: item.key as any }))}>
                                        <span class="style-text">{item.label}</span>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Extension Toggles */}
                    <div class="trend-section">
                        <span class="section-title">Extensions</span>
                        <div class="extend-pills-row">
                            <div
                                class={`extend-pill ${trendSettings().extendLeft ? 'active' : ''}`}
                                onClick={() => updateTrendSettings(prev => ({ ...prev, extendLeft: !prev.extendLeft }))}>
                                <span class={`pill-check ${trendSettings().extendLeft ? 'checked' : ''}`}>
                                    {trendSettings().extendLeft ? '✓' : ''}
                                </span>
                                <span>Extend Left</span>
                            </div>
                            <div
                                class={`extend-pill ${trendSettings().extendRight ? 'active' : ''}`}
                                onClick={() => updateTrendSettings(prev => ({ ...prev, extendRight: !prev.extendRight }))}>
                                <span class={`pill-check ${trendSettings().extendRight ? 'checked' : ''}`}>
                                    {trendSettings().extendRight ? '✓' : ''}
                                </span>
                                <span>Extend Right</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trend Line Template Action Bar */}
                <div class="panel-footer-clean">
                    <div class="template-control-group">
                        <span class="template-label">Template</span>
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
                                onClick={() => deleteTrendTemplate(selectedTrendTemplate())}>
                                &times;
                            </button>
                        </Show>
                    </div>
                    <div class="dialog-action-buttons">
                        <button
                            type="button"
                            class="btn-cancel-clean"
                            onClick={cancelTrendLine}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="btn-ok-clean"
                            onClick={confirmTrendLine}>
                            Ok
                        </button>
                    </div>
                </div>

                {/* Save Trend Line Template Dialog */}
                <Show when={showSaveTrendTemplate()}>
                    <div class="save-template-overlay">
                        <div class="save-template-dialog">
                            <div class="template-dialog-header">
                                <span class="template-dialog-title">Save drawing template</span>
                                <span class="panel-close" onClick={() => setShowSaveTrendTemplate(false)}>&times;</span>
                            </div>
                            <div class="template-dialog-body">
                                <span class="input-desc">Template name</span>
                                <input
                                    type="text"
                                    class="template-name-input"
                                    value={newTrendTemplateName()}
                                    onInput={(e: any) => setNewTrendTemplateName(e.target.value)}
                                    placeholder="e.g. Key Resistance"
                                />
                            </div>
                            <div class="template-dialog-footer">
                                <button type="button" class="btn-cancel-clean" onClick={() => setShowSaveTrendTemplate(false)}>Cancel</button>
                                <button type="button" class="btn-ok-clean" onClick={saveTrendTemplate}>Save</button>
                            </div>
                        </div>
                    </div>
                </Show>
            </Show>

            {/* ================= FIBONACCI BODY ================= */}
            <Show when={!isTrendLine()}>
                {/* Options row */}
                <div class="panel-options">
                    <label class="option-toggle">
                        <input
                            type="checkbox"
                            checked={fibExtendData().extendLeft}
                            onChange={(e: any) => setFibExtendData({ ...fibExtendData(), extendLeft: e.target.checked })}
                        />
                        <span>Extend L</span>
                    </label>
                    <label class="option-toggle">
                        <input
                            type="checkbox"
                            checked={fibExtendData().extendRight}
                            onChange={(e: any) => setFibExtendData({ ...fibExtendData(), extendRight: e.target.checked })}
                        />
                        <span>Extend R</span>
                    </label>
                    <div class="option-select">
                        <span class="option-label">Align</span>
                        <Select
                            style={{ width: '75px' }}
                            value={fibExtendData().labelAlignment}
                            dataSource={alignmentOptions}
                            onSelected={(v: any) => setFibExtendData({ ...fibExtendData(), labelAlignment: v.key })}
                        />
                    </div>
                    <div class="option-select">
                        <span class="option-label">Pos</span>
                        <Select
                            style={{ width: '75px' }}
                            value={fibExtendData().labelPosition}
                            dataSource={positionOptions}
                            onSelected={(v: any) => setFibExtendData({ ...fibExtendData(), labelPosition: v.key })}
                        />
                    </div>
                </div>

                {/* Levels list */}
                <div class="panel-levels">
                    <For each={fibExtendData().levels}>
                        {(level, index) => (
                            <div class="level-row">
                                <input
                                    type="checkbox"
                                    class="level-check"
                                    checked={level.visible}
                                    onChange={(e: any) => {
                                        const newLevels = [...fibExtendData().levels]
                                        newLevels[index()].visible = e.target.checked
                                        setFibExtendData({ ...fibExtendData(), levels: newLevels })
                                    }}
                                />
                                <input
                                    type="text"
                                    class="level-value"
                                    value={level.value}
                                    onChange={(e: any) => {
                                        const newLevels = [...fibExtendData().levels]
                                        newLevels[index()].value = Number(e.target.value)
                                        setFibExtendData({ ...fibExtendData(), levels: newLevels })
                                    }}
                                />
                                <input
                                    type="color"
                                    class="level-color"
                                    value={level.color}
                                    onInput={(e: any) => {
                                        const newLevels = [...fibExtendData().levels]
                                        newLevels[index()].color = e.target.value
                                        setFibExtendData({ ...fibExtendData(), levels: newLevels })
                                    }}
                                />
                                <span
                                    class="level-remove"
                                    onClick={() => {
                                        const newLevels = [...fibExtendData().levels]
                                        newLevels.splice(index(), 1)
                                        setFibExtendData({ ...fibExtendData(), levels: newLevels })
                                    }}>
                                    &times;
                                </span>
                            </div>
                        )}
                    </For>
                    <div
                        class="add-level"
                        onClick={() => {
                            const newLevels = [...fibExtendData().levels, { value: 0, color: '#787B86', visible: true }]
                            setFibExtendData({ ...fibExtendData(), levels: newLevels })
                        }}>
                        + Add
                    </div>
                </div>

                {/* Template Action Bar */}
                <div class="panel-footer" style={{ "margin-top": "16px", "padding": "0 12px 10px", "display": "flex", "justify-content": "space-between", "align-items": "center" }}>
                    <div class="template-selector" style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                        <span class="option-label">Template</span>
                        <Select
                            style={{ width: '120px' }}
                            value="Select..."
                            dataSource={[
                                { key: 'save_new', text: 'Save As...' },
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
                    </div>
                    <div class="action-buttons" style={{ display: 'flex', gap: '8px' }}>
                        <button class="btn-cancel" onClick={() => props.onClose()} style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #454545', color: '#fff', 'border-radius': '4px', cursor: 'pointer' }}>Cancel</button>
                        <button class="btn-confirm" onClick={confirmFibonacci} style={{ padding: '4px 12px', background: '#2962FF', border: 'none', color: '#fff', 'border-radius': '4px', cursor: 'pointer' }}>Ok</button>
                    </div>
                </div>

                {/* Save Template Dialog */}
                <Show when={showSaveFibTemplate()}>
                    <div class="save-template-overlay">
                        <div class="save-template-dialog">
                            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                                <span style={{ color: '#D1D4DC', 'font-size': '14px', 'font-weight': 'bold' }}>Save drawing template</span>
                                <span class="panel-close" onClick={() => setShowSaveFibTemplate(false)}>&times;</span>
                            </div>
                            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                                <span style={{ color: '#787B86', 'font-size': '12px' }}>New template name</span>
                                <input
                                    type="text"
                                    value={newFibTemplateName()}
                                    onInput={(e: any) => setNewFibTemplateName(e.target.value)}
                                    style={{
                                        background: '#131722', border: '1px solid #2A2E39', color: '#D1D4DC',
                                        padding: '6px 8px', 'border-radius': '4px', outline: 'none'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '8px', 'margin-top': '4px' }}>
                                <button onClick={() => setShowSaveFibTemplate(false)} style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #454545', color: '#fff', 'border-radius': '4px', cursor: 'pointer' }}>Cancel</button>
                                <button onClick={saveFibTemplate} style={{ padding: '4px 12px', background: '#2962FF', border: 'none', color: '#fff', 'border-radius': '4px', cursor: 'pointer' }}>Save</button>
                            </div>
                        </div>
                    </div>
                </Show>
            </Show>
        </div>
    )
}

export default OverlaySettingModal
