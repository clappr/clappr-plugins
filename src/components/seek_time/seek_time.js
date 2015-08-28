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
    return template(seekTimeHTML);
  }
  get attributes() {
    return {
      'class': 'seek-time hidden',
      'data-seek-time': ''
    };
  }
  constructor(mediaControl) {
    super()
    this.mediaControl = mediaControl
    this.addEventListeners()
  }

  addEventListeners() {
    this.listenTo(this.mediaControl, Events.MEDIACONTROL_MOUSEMOVE_SEEKBAR, this.showTime)
    this.listenTo(this.mediaControl, Events.MEDIACONTROL_MOUSELEAVE_SEEKBAR, this.hideTime)
  }

  showTime(event) {
    if (!this.mediaControl.container.settings.seekEnabled) {
      return
    }

    // the element must be unhidden before its width is requested, otherwise it's width will be reported as 0
    this.$el.removeClass('hidden')
    var offset = event.pageX - this.mediaControl.$seekBarContainer.offset().left
    if (offset >= 0 && offset <= this.mediaControl.$seekBarContainer.width()) {
      var timePosition = Math.min(100, Math.max((offset) / this.mediaControl.$seekBarContainer.width() * 100, 0))
      var pointerPosition = event.pageX - this.mediaControl.$el.offset().left
      pointerPosition = Math.min(Math.max(0, pointerPosition), this.mediaControl.$el.width() - this.$el.width() / 2)
      var currentTime = timePosition * this.mediaControl.container.getDuration() / 100
      var options = {
        timestamp: currentTime,
        formattedTime: formatTime(currentTime),
        pointerPosition: pointerPosition
      }

      this.update(options)
    }
  }

  hideTime() {
    this.$el.addClass('hidden')
    this.$el.css('left', '-100%')
  }

  update(options) {
    this.$el.find('[data-seek-time]').text(options.formattedTime)
    this.$el.css('left', Math.max(0, options.pointerPosition - (this.$el.width() / 2)))
  }

  render() {
      var style = Styler.getStyleFor(seekTimeStyle);
      this.$el.html(this.template());
      this.$el.append(style);
      this.mediaControl.$el.append(this.el);
  }
}
