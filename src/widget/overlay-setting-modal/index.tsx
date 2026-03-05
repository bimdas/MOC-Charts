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

import { Component, createSignal, For, Show } from 'solid-js'

import { utils, Overlay } from 'klinecharts'

import { Modal, Input, Checkbox, Select, Button } from '../../component'

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
    const [extendData, setExtendData] = createSignal(
        utils.clone(props.overlay.extendData || defaultFibonacciExtendData)
    )

    const alignmentOptions = [
        { key: 'left', text: i18n('left', props.locale) },
        { key: 'center', text: i18n('center', props.locale) },
        { key: 'right', text: i18n('right', props.locale) }
    ]

    const positionOptions = [
        { key: 'top', text: i18n('top', props.locale) },
        { key: 'middle', text: i18n('middle', props.locale) },
        { key: 'bottom', text: i18n('bottom', props.locale) }
    ]

    return (
        <Modal
            title={i18n('settings', props.locale)}
            width={400}
            buttons={[
                {
                    type: 'confirm',
                    children: i18n('confirm', props.locale),
                    onClick: () => {
                        props.onConfirm(extendData())
                        props.onClose()
                    }
                }
            ]}
            onClose={props.onClose}>
            <div class="klinecharts-pro-overlay-setting-modal-content">
                <Show when={props.overlay.name === 'fibonacciSegment'}>
                    <div class="setting-row">
                        <Checkbox
                            checked={extendData().extendLeft}
                            label={i18n('extendLeft', props.locale)}
                            onChange={v => setExtendData({ ...extendData(), extendLeft: v })}
                        />
                        <Checkbox
                            checked={extendData().extendRight}
                            label={i18n('extendRight', props.locale)}
                            onChange={v => setExtendData({ ...extendData(), extendRight: v })}
                        />
                    </div>
                    <div class="setting-row">
                        <span>{i18n('labelAlignment', props.locale)}</span>
                        <Select
                            style={{ width: '120px' }}
                            value={extendData().labelAlignment}
                            dataSource={alignmentOptions}
                            onSelected={(v: any) => setExtendData({ ...extendData(), labelAlignment: v.key })}
                        />
                    </div>
                    <div class="setting-row">
                        <span>{i18n('labelPosition', props.locale)}</span>
                        <Select
                            style={{ width: '120px' }}
                            value={extendData().labelPosition}
                            dataSource={positionOptions}
                            onSelected={(v: any) => setExtendData({ ...extendData(), labelPosition: v.key })}
                        />
                    </div>
                    <div class="levels-container">
                        <For each={extendData().levels}>
                            {(level, index) => (
                                <div class="level-row">
                                    <Checkbox
                                        checked={level.visible}
                                        onChange={v => {
                                            const newLevels = [...extendData().levels];
                                            newLevels[index()].visible = v;
                                            setExtendData({ ...extendData(), levels: newLevels });
                                        }} />
                                    <Input
                                        style={{ width: '100px', 'margin-left': '8px' }}
                                        value={level.value}
                                        onChange={v => {
                                            const newLevels = [...extendData().levels];
                                            newLevels[index()].value = Number(v);
                                            setExtendData({ ...extendData(), levels: newLevels });
                                        }} />
                                    <input
                                        type="color"
                                        style="margin-left: 8px; border: none; padding: 0; width: 24px; height: 24px; cursor: pointer; background: transparent; border-radius: 4px;"
                                        value={level.color}
                                        onChange={(e: any) => {
                                            const newLevels = [...extendData().levels];
                                            newLevels[index()].color = e.target.value;
                                            setExtendData({ ...extendData(), levels: newLevels });
                                        }} />
                                    <span
                                        style="margin-left: auto; cursor: pointer; color: #f23645; font-size: 16px; font-weight: bold; width: 24px; text-align: center; user-select: none;"
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
                            style="margin-top: 12px; cursor: pointer; color: #2962ff; font-weight: 500; font-size: 14px;"
                            onClick={() => {
                                const newLevels = [...extendData().levels, { value: 0, color: '#787B86', visible: true }];
                                setExtendData({ ...extendData(), levels: newLevels });
                            }}>
                            + Add Level
                        </div>
                    </div>
                </Show>
            </div>
        </Modal>
    )
}

export default OverlaySettingModal
