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
    '#2962FF', // Blue
    '#089981', // Teal Green
    '#F23645', // Red
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#E0E3EB', // Silver / White
    '#FFD700', // Yellow
    '#00BCD4'  // Cyan
]

const OverlaySettingModal: Component<OverlaySettingModalProps> = props => {
    let panelRef: HTMLDivElement | undefined

    const isTrendLine = () => props.overlay.name === 'segment'

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

    // Confirm Trend Line
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

    // Confirm Fibonacci
    const confirmFibonacci = () => {
        const data = fibExtendData()
        saveLastFibSettings(data)
        props.onConfirm(data)
        props.onClose()
    }

    const handleConfirm = () => {
        if (isTrendLine()) {
            confirmTrendLine()
        } else {
            confirmFibonacci()
        }
    }

    const handleClickOutside = (e: MouseEvent) => {
        if (panelRef && !panelRef.contains(e.target as Node)) {
            handleConfirm()
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
            setTrendSettings(utils.clone(template.data))
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
                <span class="panel-title">{isTrendLine() ? 'Trend Line Settings' : 'Fib Settings'}</span>
                <span
                    class="panel-close"
                    onClick={handleConfirm}>
                    &times;
                </span>
            </div>

            {/* ================= TREND LINE BODY ================= */}
            <Show when={isTrendLine()}>
                <div class="panel-trendline">
                    {/* Color Section */}
                    <div class="setting-group">
                        <span class="group-label">Color</span>
                        <div class="color-control-row">
                            <label
                                class="color-picker-trigger"
                                style={{ "background-color": trendSettings().color }}>
                                <input
                                    type="color"
                                    value={trendSettings().color}
                                    onInput={(e: any) => setTrendSettings({ ...trendSettings(), color: e.target.value })}
                                />
                            </label>
                            <input
                                type="text"
                                class="color-hex-input"
                                value={trendSettings().color}
                                onInput={(e: any) => {
                                    const val = e.target.value.trim()
                                    if (/^#[0-9A-Fa-f]{3,8}$/.test(val)) {
                                        setTrendSettings({ ...trendSettings(), color: val })
                                    }
                                }}
                            />
                        </div>
                        <div class="color-presets-row">
                            <For each={PRESET_COLORS}>
                                {(preset) => (
                                    <div
                                        class={`preset-swatch ${trendSettings().color?.toLowerCase() === preset.toLowerCase() ? 'active' : ''}`}
                                        style={{ "background-color": preset }}
                                        onClick={() => setTrendSettings({ ...trendSettings(), color: preset })}
                                    />
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Thickness Section */}
                    <div class="setting-group">
                        <span class="group-label">Thickness</span>
                        <div class="thickness-buttons-row">
                            <For each={[1, 2, 3, 4]}>
                                {(thick) => (
                                    <button
                                        type="button"
                                        class={`thickness-btn ${trendSettings().size === thick ? 'active' : ''}`}
                                        onClick={() => setTrendSettings({ ...trendSettings(), size: thick })}>
                                        <div
                                            class="line-preview"
                                            style={{
                                                height: `${thick}px`,
                                                "background-color": trendSettings().color || '#2962FF'
                                            }}
                                        />
                                        <span class="thickness-label">{thick}px</span>
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Style Section */}
                    <div class="setting-group">
                        <span class="group-label">Line Style</span>
                        <div class="style-pills-row">
                            <For each={[
                                { key: 'solid', label: 'Solid' },
                                { key: 'dashed', label: 'Dashed' },
                                { key: 'dotted', label: 'Dotted' }
                            ]}>
                                {(item) => (
                                    <button
                                        type="button"
                                        class={`style-pill ${trendSettings().style === item.key ? 'active' : ''}`}
                                        onClick={() => setTrendSettings({ ...trendSettings(), style: item.key as any })}>
                                        {item.label}
                                    </button>
                                )}
                            </For>
                        </div>
                    </div>

                    {/* Extensions Section */}
                    <div class="setting-group">
                        <span class="group-label">Extend</span>
                        <div class="extend-checkboxes-row">
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={trendSettings().extendLeft}
                                    onChange={(e: any) => setTrendSettings({ ...trendSettings(), extendLeft: e.target.checked })}
                                />
                                <span>Extend Left</span>
                            </label>
                            <label class="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={trendSettings().extendRight}
                                    onChange={(e: any) => setTrendSettings({ ...trendSettings(), extendRight: e.target.checked })}
                                />
                                <span>Extend Right</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Trend Line Template Action Bar */}
                <div class="panel-footer" style={{ "margin-top": "4px", "padding": "10px 14px", "border-top": "1px solid var(--klinecharts-pro-border-color)", "display": "flex", "justify-content": "space-between", "align-items": "center" }}>
                    <div class="template-selector" style={{ display: 'flex', 'align-items': 'center', gap: '6px' }}>
                        <span class="option-label" style={{ "font-size": "11px", color: "var(--klinecharts-pro-text-second-color)" }}>Template</span>
                        <Select
                            style={{ width: '110px' }}
                            value={selectedTrendTemplate()}
                            dataSource={[
                                { key: 'save_new', text: 'Save As...' },
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
                        <Show when={selectedTrendTemplate() !== 'Select...' && selectedTrendTemplate() !== 'Save As...'}>
                            <span
                                class="panel-close"
                                title="Delete template"
                                style={{ "font-size": "14px", cursor: "pointer", color: "#F23645", "margin-left": "2px" }}
                                onClick={() => deleteTrendTemplate(selectedTrendTemplate())}>
                                &#128465;
                            </span>
                        </Show>
                    </div>
                    <div class="action-buttons" style={{ display: 'flex', gap: '8px' }}>
                        <button class="btn-cancel" onClick={() => props.onClose()} style={{ padding: '5px 12px', background: 'transparent', border: '1px solid var(--klinecharts-pro-border-color)', color: 'var(--klinecharts-pro-text-color)', 'border-radius': '4px', cursor: 'pointer', 'font-size': '11px' }}>Cancel</button>
                        <button class="btn-confirm" onClick={confirmTrendLine} style={{ padding: '5px 14px', background: '#2962FF', border: 'none', color: '#fff', 'border-radius': '4px', cursor: 'pointer', 'font-size': '11px', 'font-weight': '600' }}>Ok</button>
                    </div>
                </div>

                {/* Save Trend Line Template Dialog */}
                <Show when={showSaveTrendTemplate()}>
                    <div class="save-template-overlay" style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.85)', display: 'flex', 'align-items': 'center', 'justify-content': 'center',
                        'z-index': 100, 'border-radius': '6px'
                    }}>
                        <div class="save-template-dialog" style={{
                            background: 'var(--klinecharts-pro-popover-background-color)', padding: '16px', 'border-radius': '6px', width: '250px',
                            display: 'flex', 'flex-direction': 'column', gap: '12px', border: '1px solid var(--klinecharts-pro-border-color)',
                            'box-shadow': '0 8px 24px rgba(0,0,0,0.6)'
                        }}>
                            <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                                <span style={{ color: 'var(--klinecharts-pro-text-color)', 'font-size': '13px', 'font-weight': '600' }}>Save trend line template</span>
                                <span class="panel-close" onClick={() => setShowSaveTrendTemplate(false)}>&times;</span>
                            </div>
                            <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                                <span style={{ color: 'var(--klinecharts-pro-text-second-color)', 'font-size': '11px' }}>Template name</span>
                                <input
                                    type="text"
                                    value={newTrendTemplateName()}
                                    onInput={(e: any) => setNewTrendTemplateName(e.target.value)}
                                    placeholder="e.g. Resistance Line"
                                    style={{
                                        background: 'rgba(0,0,0,0.25)', border: '1px solid var(--klinecharts-pro-border-color)', color: 'var(--klinecharts-pro-text-color)',
                                        padding: '6px 8px', 'border-radius': '4px', outline: 'none', 'font-size': '12px'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '8px', 'margin-top': '4px' }}>
                                <button onClick={() => setShowSaveTrendTemplate(false)} style={{ padding: '4px 12px', background: 'transparent', border: '1px solid var(--klinecharts-pro-border-color)', color: 'var(--klinecharts-pro-text-color)', 'border-radius': '4px', cursor: 'pointer', 'font-size': '11px' }}>Cancel</button>
                                <button onClick={saveTrendTemplate} style={{ padding: '4px 14px', background: '#2962FF', border: 'none', color: '#fff', 'border-radius': '4px', cursor: 'pointer', 'font-size': '11px', 'font-weight': '600' }}>Save</button>
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
                    <div class="save-template-overlay" style={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.8)', display: 'flex', 'align-items': 'center', 'justify-content': 'center',
                        'z-index': 100, 'border-radius': '4px'
                    }}>
                        <div class="save-template-dialog" style={{
                            background: '#1E222D', padding: '16px', 'border-radius': '4px', width: '250px',
                            display: 'flex', 'flex-direction': 'column', gap: '12px', border: '1px solid #2A2E39'
                        }}>
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
