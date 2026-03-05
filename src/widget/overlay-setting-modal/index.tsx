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

import { Component, createSignal, For, onMount, onCleanup } from 'solid-js'

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

const OverlaySettingModal: Component<OverlaySettingModalProps> = props => {
    let panelRef: HTMLDivElement | undefined

    const [extendData, setExtendData] = createSignal(
        utils.clone(props.overlay.extendData || defaultFibonacciExtendData)
    )

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
            props.onConfirm(extendData())
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
                        props.onConfirm(extendData())
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
        </div>
    )
}

export default OverlaySettingModal
