// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

var UIContainerPlugin = require('ui_container_plugin');
var Styler = require('../../base/styler');
var JST = require('../../base/jst');

class SpinnerThreeBouncePlugin extends UIContainerPlugin {
  get name() { return 'spinner' }
  get attributes() {
    return {
      'data-spinner':'',
      'class': 'spinner-three-bounce'
    }
  }

  constructor(options) {
    super(options)
    this.template = JST.spinner_three_bounce
    this.listenTo(this.container, 'container:state:buffering', this.onBuffering)
    this.listenTo(this.container, 'container:state:bufferfull', this.onBufferFull)
    this.listenTo(this.container, 'container:stop', this.onStop)
    this.render()
  }

  onBuffering() {
    this.$el.show()
  }

  onBufferFull() {
    this.$el.hide()
  }

  onStop() {
    this.$el.hide()
  }

  render() {
    this.$el.html(this.template())
    var style = Styler.getStyleFor('spinner_three_bounce')
    this.container.$el.append(style)
    this.container.$el.append(this.$el)
    this.$el.hide()
    return this
  }
}

module.exports = SpinnerThreeBouncePlugin;
