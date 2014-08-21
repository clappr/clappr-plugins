// Copyright 2014 Globo.com Player authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

var UIPlugin = require('../../base/ui_plugin');
var Styler = require('../../base/styler');
var JST = require('../../base/jst');

class SpinnerLoading extends UIPlugin {
  get name() { return 'spinner_loading' }
  get attributes() {
    return { 'data-spinner':'' }
  }

  initialize(options) {
    super(options)
    this.template = JST[this.name]
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
    this.$el.hide()
    this.$el.html(this.template())
    var style = Styler.getStyleFor(this.name)
    this.container.$el.append(style)
    this.container.$el.append(this.$el)
    return this
  }
}

module.exports = SpinnerLoading;

