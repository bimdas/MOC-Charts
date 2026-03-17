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

export default (className?: string) => (
  <svg class={`icon-overlay ${className ?? ''}`} viewBox="0 0 22 22">
    <path d="M18.8,3.2l-1.1-1.1c-0.3-0.3-0.7-0.3-1,0l-15,15c-0.3,0.3-0.3,0.7,0,1l1.1,1.1c0.3,0.3,0.7,0.3,1,0l15-15C19.1,3.9,19.1,3.5,18.8,3.2z M17.4,6.2l-1-1l0.7-0.7l1,1L17.4,6.2z M14.6,9l-1-1l0.7-0.7l1,1L14.6,9z M11.8,11.8l-1-1l0.7-0.7l1,1L11.8,11.8z M8.9,14.6l-1-1l0.7-0.7l1,1L8.9,14.6z M6.1,17.4l-1-1l0.7-0.7l1,1L6.1,17.4z" fill="currentColor"/>
  </svg>
)
