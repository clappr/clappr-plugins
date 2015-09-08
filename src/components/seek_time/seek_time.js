// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

import {formatTime} from 'base/utils'

import UIObject from 'base/ui_object'
import Styler from 'base/styler'
import template from 'base/template'
import Events from 'base/events'
import seekTimeStyle from './public/seek_time.scss'
import seekTimeHTML from './public/seek_time.html'

export default class SeekTime extends UIObject {
  get name() { return 'seek_time' }
  get template() {
    return template(seekTimeHTML)
  }
  get attributes() {
    return {
      'class': 'seek-time hidden',
      'data-seek-time': ''
    }
  }
  constructor(mediaControl) {
    super()
    this.mediaControl = mediaControl
    this.rendered = false
    this.hoveringOverSeekBar = false
    this.hoverPosition = null
    this.addEventListeners()
  }

  addEventListeners() {
    this.listenTo(this.mediaControl, Events.MEDIACONTROL_MOUSEMOVE_SEEKBAR, this.showTime)
    this.listenTo(this.mediaControl, Events.MEDIACONTROL_MOUSELEAVE_SEEKBAR, this.hideTime)
  }

  showTime(event) {
    this.hoveringOverSeekBar = true
    this.calculateHoverPosition(event)
    this.update()
  }

  hideTime() {
    this.hoveringOverSeekBar = false
    this.update()
  }

  calculateHoverPosition(event) {
    var offset = event.pageX - this.mediaControl.$seekBarContainer.offset().left
    // proportion into the seek bar that the mouse is hovered over 0-1
    this.hoverPosition = Math.min(1, Math.max(offset/this.mediaControl.$seekBarContainer.width(), 0))
  }

  update() {
    if (!this.rendered) {
      // update() is always called after a render
      return
    }
    if (!this.shouldBeVisible()) {
      this.$el.addClass('hidden')
      this.$el.css('left', "-100%")
    }
    else {
      var currentTime = this.hoverPosition * this.mediaControl.container.getDuration()
      var formattedTime = formatTime(currentTime)
      this.$textEl.text(formattedTime)
      // the element must be unhidden before its width is requested, otherwise it's width will be reported as 0
      this.$el.removeClass('hidden')
      var containerWidth = this.mediaControl.$seekBarContainer.width()
      var elWidth = this.$el.width()
      var elLeftPos = this.hoverPosition * containerWidth
      elLeftPos -= elWidth / 2
      elLeftPos = Math.max(0, Math.min(elLeftPos, containerWidth - elWidth))
      this.$el.css('left', elLeftPos)
    }
  }

  shouldBeVisible() {
    return this.mediaControl.container.settings.seekEnabled && this.hoveringOverSeekBar
  }

  render() {
    this.rendered = true
    var style = Styler.getStyleFor(seekTimeStyle)
    this.$el.html(this.template())
    this.$el.append(style)
    this.mediaControl.$el.append(this.el)
    this.$textEl = this.$el.find('[data-seek-time]')
    this.update()
  }
}
