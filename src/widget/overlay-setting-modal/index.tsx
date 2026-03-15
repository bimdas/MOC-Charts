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

import { Component, createSignal, For, onMount, onCleanup, Show } from 'solid-js'

import { utils, Overlay } from 'klinecharts'

import { Select } from '../../component'

import i18n from '../../i18n'

export interface OverlaySettingModalProps {
    locale: string
    overlay: Overlay
    onClose: () => void
    onConfirm: (extendData: any) => void
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

const LAST_SETTINGS_KEY = 'klinecharts_fib_last_settings'

export function getLastFibSettings(): any {
    try {
        const saved = localStorage.getItem(LAST_SETTINGS_KEY)
        if (saved) return JSON.parse(saved)
    } catch (e) { }
    return utils.clone(defaultFibonacciExtendData)
}

function saveLastFibSettings(data: any): void {
    try {
        localStorage.setItem(LAST_SETTINGS_KEY, JSON.stringify(data))
    } catch (e) { }
}

const OverlaySettingModal: Component<OverlaySettingModalProps> = props => {
    let panelRef: HTMLDivElement | undefined

    const [extendData, setExtendData] = createSignal(
        utils.clone(props.overlay.extendData || defaultFibonacciExtendData)
    )

    // Templates State
    const [templates, setTemplates] = createSignal<Array<{ name: string, data: any }>>([])
    const [showSaveTemplate, setShowSaveTemplate] = createSignal(false)
    const [newTemplateName, setNewTemplateName] = createSignal('')

    // Load templates on mount
    onMount(() => {
        try {
            const saved = localStorage.getItem('klinecharts_fib_templates')
            if (saved) {
                setTemplates(JSON.parse(saved))
            }
        } catch (e) { }

        setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside)
        }, 50)
    })

    const saveTemplate = () => {
        const name = newTemplateName().trim()
        if (!name) return

        const currentTemplates = [...templates()]
        const existingIdx = currentTemplates.findIndex(t => t.name === name)

        const templateData = { name, data: utils.clone(extendData()) }

        if (existingIdx >= 0) {
            currentTemplates[existingIdx] = templateData
        } else {
            currentTemplates.push(templateData)
        }

        setTemplates(currentTemplates)
        localStorage.setItem('klinecharts_fib_templates', JSON.stringify(currentTemplates))
        // Auto-sync via event system so LiveChart can pick it up
        window.dispatchEvent(new CustomEvent('klinecharts_fib_templates_changed', {
            detail: currentTemplates
        }))

        setShowSaveTemplate(false)
        setNewTemplateName('')
    }

    const applyTemplate = (name: string) => {
        const template = templates().find(t => t.name === name)
        if (template) {
            setExtendData(utils.clone(template.data))
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

    const handleClickOutside = (e: MouseEvent) => {
        if (panelRef && !panelRef.contains(e.target as Node)) {
            const data = extendData()
            saveLastFibSettings(data)
            props.onConfirm(data)
            props.onClose()
        }
    }

    onMount(() => {
        setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside)
        }, 50)
    })

    onCleanup(() => {
        document.removeEventListener('mousedown', handleClickOutside)
    })

    return (
        <div class="klinecharts-pro-overlay-setting-panel" ref={panelRef}>
            {/* Header */}
            <div class="panel-header">
                <span class="panel-title">Fib Settings</span>
                <span
                    class="panel-close"
                    onClick={() => {
                        const data = extendData()
                        saveLastFibSettings(data)
                        props.onConfirm(data)
                        props.onClose()
                    }}>
                    &times;
                </span>
            </div>

            {/* Options row */}
            <div class="panel-options">
                <label class="option-toggle">
                    <input
                        type="checkbox"
                        checked={extendData().extendLeft}
                        onChange={(e: any) => setExtendData({ ...extendData(), extendLeft: e.target.checked })}
                    />
                    <span>Extend L</span>
                </label>
                <label class="option-toggle">
                    <input
                        type="checkbox"
                        checked={extendData().extendRight}
                        onChange={(e: any) => setExtendData({ ...extendData(), extendRight: e.target.checked })}
                    />
                    <span>Extend R</span>
                </label>
                <div class="option-select">
                    <span class="option-label">Align</span>
                    <Select
                        style={{ width: '75px' }}
                        value={extendData().labelAlignment}
                        dataSource={alignmentOptions}
                        onSelected={(v: any) => setExtendData({ ...extendData(), labelAlignment: v.key })}
                    />
                </div>
                <div class="option-select">
                    <span class="option-label">Pos</span>
                    <Select
                        style={{ width: '75px' }}
                        value={extendData().labelPosition}
                        dataSource={positionOptions}
                        onSelected={(v: any) => setExtendData({ ...extendData(), labelPosition: v.key })}
                    />
                </div>
            </div>

            {/* Levels list */}
            <div class="panel-levels">
                <For each={extendData().levels}>
                    {(level, index) => (
                        <div class="level-row">
                            <input
                                type="checkbox"
                                class="level-check"
                                checked={level.visible}
                                onChange={(e: any) => {
                                    const newLevels = [...extendData().levels];
                                    newLevels[index()].visible = e.target.checked;
                                    setExtendData({ ...extendData(), levels: newLevels });
                                }}
                            />
                            <input
                                type="text"
                                class="level-value"
                                value={level.value}
                                onChange={(e: any) => {
                                    const newLevels = [...extendData().levels];
                                    newLevels[index()].value = Number(e.target.value);
                                    setExtendData({ ...extendData(), levels: newLevels });
                                }}
                            />
                            <input
                                type="color"
                                class="level-color"
                                value={level.color}
                                onInput={(e: any) => {
                                    const newLevels = [...extendData().levels];
                                    newLevels[index()].color = e.target.value;
                                    setExtendData({ ...extendData(), levels: newLevels });
                                }}
                            />
                            <span
                                class="level-remove"
                                onClick={() => {
                                    const newLevels = [...extendData().levels];
                                    newLevels.splice(index(), 1);
                                    setExtendData({ ...extendData(), levels: newLevels });
                                }}>
                                &times;
                            </span>
                        </div>
                    )}
                </For>
                <div
                    class="add-level"
                    onClick={() => {
                        const newLevels = [...extendData().levels, { value: 0, color: '#787B86', visible: true }];
                        setExtendData({ ...extendData(), levels: newLevels });
                    }}>
                    + Add
                </div>
            </div>

            {/* Template Action Bar */}
            <div class="panel-footer" style={{ "margin-top": "16px", "display": "flex", "justify-content": "space-between", "align-items": "center" }}>
                <div class="template-selector" style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                    <span class="option-label">Template</span>
                    <Select
                        style={{ width: '120px' }}
                        value="Select..."
                        dataSource={[
                            { key: 'save_new', text: 'Save As...' },
                            ...templates().map(t => ({ key: t.name, text: t.name }))
                        ]}
                        onSelected={(v: any) => {
                            if (v.key === 'save_new') {
                                setShowSaveTemplate(true)
                            } else {
                                applyTemplate(v.key)
                            }
                        }}
                    />
                </div>
                <div class="action-buttons" style={{ display: 'flex', gap: '8px' }}>
                    <button class="btn-cancel" onClick={() => props.onClose()} style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #454545', color: '#fff', 'border-radius': '4px', cursor: 'pointer' }}>Cancel</button>
                    <button class="btn-confirm" onClick={() => { const data = extendData(); saveLastFibSettings(data); props.onConfirm(data); props.onClose(); }} style={{ padding: '4px 12px', background: '#2962FF', border: 'none', color: '#fff', 'border-radius': '4px', cursor: 'pointer' }}>Ok</button>
                </div>
            </div>

            {/* Save Template Dialog */}
            <Show when={showSaveTemplate()}>
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
                            <span class="panel-close" onClick={() => setShowSaveTemplate(false)}>&times;</span>
                        </div>
                        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                            <span style={{ color: '#787B86', 'font-size': '12px' }}>New template name</span>
                            <input
                                type="text"
                                value={newTemplateName()}
                                onInput={(e: any) => setNewTemplateName(e.target.value)}
                                style={{
                                    background: '#131722', border: '1px solid #2A2E39', color: '#D1D4DC',
                                    padding: '6px 8px', 'border-radius': '4px', outline: 'none'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', 'justify-content': 'flex-end', gap: '8px', 'margin-top': '4px' }}>
                            <button onClick={() => setShowSaveTemplate(false)} style={{ padding: '4px 12px', background: 'transparent', border: '1px solid #454545', color: '#fff', 'border-radius': '4px', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={saveTemplate} style={{ padding: '4px 12px', background: '#2962FF', border: 'none', color: '#fff', 'border-radius': '4px', cursor: 'pointer' }}>Save</button>
                        </div>
                    </div>
                </div>
            </Show>
        </div>
    )
}

export default OverlaySettingModal
