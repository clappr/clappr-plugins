var Container = require('container');
var FakePlayback = require('playback');
var Stats = require('../src/plugins/stats');

describe('StatsPlugin', function() {
  beforeEach(() => {
    this.playback = new FakePlayback();
    this.container = new Container({playback: this.playback});
    this.stats = new Stats({container: this.container});
    this.container.addPlugin(this.stats);
    this.clock = sinon.useFakeTimers(Date.now());
  });

  afterEach(() => this.clock.restore());

  it('should calculate startup time', () => {
    this.container.buffering();
    this.clock.tick(1000);
    this.container.bufferfull();
    expect(this.stats.getStats().startupTime).to.equal(1000);
  });

  it('should calculate rebuffer events', () => {
    // to maintain compatibility with the first ping version
    // we'll increment rebuffers even on the startup rebuffer event
    this.container.buffering();
    this.container.bufferfull();

    this.container.buffering();
    this.container.bufferfull();

    expect(this.stats.getStats().rebuffers).to.equal(2);
  });

  it('should calculate total rebuffer time', () => {
    this.container.play();
    this.container.buffering(); // startup time
    this.clock.tick(1000);
    this.container.bufferfull();

    this.container.buffering();
    this.clock.tick(1000);
    this.container.bufferfull();

    this.container.buffering();
    this.clock.tick(500);
    this.container.bufferfull();

    expect(this.stats.getStats().rebufferingTime).to.equal(1500);
  });

  it('should avoid NaN on watching time and rebuffering time when more than one bufferfull is dispatched', () => {
    this.container.play();
    this.container.buffering(); // startup time
    this.clock.tick(1000);
    this.container.bufferfull();
    this.container.bufferfull();

    this.clock.tick(2000); // watching for 2 secs
    expect(this.stats.getStats().watchingTime).to.equal(2000);
    expect(this.stats.getStats().rebufferingTime).to.equal(0);
    expect(this.stats.getStats().startupTime).to.equal(1000);
  });

  it('should calculate total watching time', () => {
    this.container.play();
    this.container.buffering(); // startup time
    this.clock.tick(1000);
    this.container.bufferfull();

    this.clock.tick(2000); // watching for 2 secs
    expect(this.stats.getStats().watchingTime).to.equal(2000);

    this.container.buffering();
    this.clock.tick(500);
    this.container.bufferfull();

    this.clock.tick(2000); // watching for 2 secs
    expect(this.stats.getStats().watchingTime).to.equal(4000);
  });

  it('should consider current rebuffering state', () => {
    this.container.play();
    this.container.buffering(); // startup time
    this.clock.tick(1000);
    this.container.bufferfull();

    this.container.buffering();
    this.clock.tick(1000);
    this.container.bufferfull();
    this.clock.tick(10000);

    this.container.buffering();
    this.clock.tick(500);
    // still rebuffering

    expect(this.stats.getStats().rebufferingTime).to.equal(1500);
    expect(this.stats.getStats().watchingTime).to.equal(10000);
  });

  it('should announce statistics periodically', () => {
    sinon.spy(this.container, 'statsReport');
    var stats = new Stats({container: container, reportInterval: 10});
    container.addPlugin(stats);
    this.playback.trigger('playback:play');
    // clock.tick freezes when used with {set,clear}Interval and I don't know why
    setTimeout(() => {
      assert.ok(this.container.statsReport.calledTwice);
      this.container.restore();
    }, 20);
  });

});
